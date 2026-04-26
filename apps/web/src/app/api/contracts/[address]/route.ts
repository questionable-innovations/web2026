import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";
import { serializeJson } from "@/lib/json";
import { readEscrow } from "@/lib/server-chain";

const ZERO = "0x0000000000000000000000000000000000000000";
const TERMINAL_STATES = new Set(["Closed", "Rescued"]);

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  const head = local.slice(0, 1);
  return `${head}${"·".repeat(Math.max(local.length - 1, 1))}@${domain}`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const lower = address.toLowerCase();
  let row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Self-heal stale cache: the countersign / release / dispute POSTs that
  // mirror on-chain state into the DB are best-effort. If the client-side
  // call drops after the tx lands (page closed, network blip, 409 from a
  // stale RPC read), the DB stays behind while the escrow has moved on -
  // and Party A's view sticks on "waiting for countersign" forever. Re-read
  // on-chain whenever the cached state could still change.
  if (row.escrowAddress && !TERMINAL_STATES.has(row.state)) {
    const onchain = await readEscrow(
      row.escrowAddress as `0x${string}`,
    ).catch(() => null);
    if (onchain) {
      const updates: { state?: string; partyBWallet?: string } = {};
      if (onchain.state !== row.state) updates.state = onchain.state;
      if (onchain.partyB !== ZERO && !row.partyBWallet) {
        updates.partyBWallet = onchain.partyB.toLowerCase();
      }
      if (Object.keys(updates).length > 0) {
        await db
          .update(contracts)
          .set(updates)
          .where(eq(contracts.id, row.id));
        row = { ...row, ...updates };
      }
    }
  }

  let fields: Record<string, unknown> = {};
  try {
    fields = JSON.parse(row.fieldsJson) as Record<string, unknown>;
  } catch {
    fields = {};
  }
  const counterpartyEmail = (fields.counterpartyEmail as string) ?? null;

  return NextResponse.json(serializeJson({
    id: row.id,
    escrowAddress: row.escrowAddress,
    title: row.title,
    pdfCid: row.pdfCid,
    pdfHash: row.pdfHash,
    signedPdfCid: row.signedPdfCid,
    hasSignedPdf: Boolean(row.signedPdfCid || row.signedPdfBlob),
    partyAWallet: row.partyAWallet,
    partyBWallet: row.partyBWallet,
    partyAName: (fields.partyAName as string) ?? null,
    counterpartyEmailMasked: counterpartyEmail ? maskEmail(counterpartyEmail) : null,
    counterpartyEmail,
    counterpartyName: (fields.counterpartyName as string) ?? null,
    depositToken: row.depositToken,
    depositAmount: row.depositAmount,
    totalDue: row.totalDue,
    dealDeadline: (fields.dealDeadline as number) ?? null,
    state: row.state,
    createdAt: row.createdAt,
  }));
}
