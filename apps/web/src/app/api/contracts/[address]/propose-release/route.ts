import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { attestations, contracts } from "@/server/db/schema";
import { readEscrow } from "@/lib/server-chain";
import { ReleaseProposalEmail } from "./email-temp";

/// Called by Party A's client immediately after `proposeRelease()` lands.
/// Verifies on-chain that the proposal exists, syncs the cached state, and
/// emails the counterparty a one-tap deep link back to the release page.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const lower = address.toLowerCase();

  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const onchain = await readEscrow(address as `0x${string}`).catch(() => null);
  if (!onchain) {
    return NextResponse.json(
      { error: "escrow not deployed" },
      { status: 409 },
    );
  }
  if (onchain.state !== "Releasing") {
    return NextResponse.json(
      { error: `escrow not in Releasing (${onchain.state})` },
      { status: 409 },
    );
  }

  const fields = parseFields(row.fieldsJson);
  const proposer = onchain.proposedReleaseBy.toLowerCase();
  const alreadyEmailedFor =
    typeof fields.releaseProposalEmailedFor === "string"
      ? fields.releaseProposalEmailedFor.toLowerCase()
      : null;
  if (alreadyEmailedFor === proposer) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      cached: true,
    });
  }

  await db
    .update(contracts)
    .set({ state: onchain.state })
    .where(eq(contracts.id, row.id));

  const sigs = await db
    .select()
    .from(attestations)
    .where(eq(attestations.contractId, row.id));
  const counterparty =
    proposer === onchain.partyA.toLowerCase()
      ? onchain.partyB
      : onchain.partyA;
  const counterpartySig = sigs.find(
    (s) => s.wallet.toLowerCase() === counterparty.toLowerCase(),
  );
  const proposerSig = sigs.find(
    (s) => s.wallet.toLowerCase() === proposer,
  );

  const origin = originFor(req);
  const url = `${origin}/c/${address}/release`;
  const amount = row.depositAmount;

  let emailSent = false;
  let emailError: string | null = null;

  if (counterpartySig?.email) {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM ?? "noreply@example.com";

    if (apiKey) {
      const resend = new Resend(apiKey);
      try {
        const result = await resend.emails.send({
          from,
          to: counterpartySig.email,
          subject: `Release $${amount} for ${row.title}?`,
          react: ReleaseProposalEmail({
            recipientName: counterpartySig.name,
            proposerName: proposerSig?.name ?? "Your counterparty",
            title: row.title,
            amount,
            url,
          }),
        });
        if (result.error) {
          emailError = JSON.stringify(result.error);
        } else {
          emailSent = true;
        }
      } catch (err) {
        emailError = err instanceof Error ? err.message : String(err);
      }
    } else {
      console.log(
        `[release] would email ${counterpartySig.email}: ${url}`,
      );
    }
  }

  // Mark this proposer as notified so client retries (or refresh-storms)
  // don't fan out duplicate emails. A fresh `proposeRelease` after a
  // dispute cycle will use a different `proposer` and re-trigger naturally.
  if (emailSent) {
    const merged = { ...fields, releaseProposalEmailedFor: proposer };
    await db
      .update(contracts)
      .set({ fieldsJson: JSON.stringify(merged) })
      .where(eq(contracts.id, row.id));
  }

  return NextResponse.json({ ok: true, emailSent, emailError, url });
}

function parseFields(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function originFor(req: Request): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
