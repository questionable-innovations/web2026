import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { z } from "zod";
import { Resend } from "resend";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { ShareLinkEmail } from "./email-temp";

const Body = z.object({
  link: z.string().url(),
});

/// Sends the share link to Party B from the server. The link contains the
/// bearer secret in its URL fragment; we use it transiently to compose the
/// email and never persist or log it.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { link } = parsed.data;

  const lower = address.toLowerCase();
  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields = parseFields(row.fieldsJson);
  const counterpartyEmail =
    typeof fields.counterpartyEmail === "string"
      ? fields.counterpartyEmail
      : null;
  const counterpartyName =
    typeof fields.counterpartyName === "string"
      ? fields.counterpartyName
      : null;
  const partyAName =
    typeof fields.partyAName === "string" ? fields.partyAName : null;

  if (!counterpartyEmail) {
    return NextResponse.json(
      { error: "no counterparty email on file" },
      { status: 409 },
    );
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@example.com";

  if (!apiKey) {
    // Dev fallback: don't echo the link (it carries the secret).
    console.log(
      `[share] would email ${counterpartyEmail} for ${row.escrowAddress}`,
    );
    return NextResponse.json({ ok: true, emailSent: false });
  }

  const resend = new Resend(apiKey);
  try {
    const result = await resend.emails.send({
      from,
      to: counterpartyEmail,
      subject: `Sign & seal: ${row.title}`,
      react: ShareLinkEmail({
        recipientName: counterpartyName,
        senderName: partyAName,
        title: row.title,
        amount: row.depositAmount,
        url: link,
      }),
    });
    if (result.error) {
      return NextResponse.json(
        { error: "email send failed" },
        { status: 502 },
      );
    }
  } catch {
    return NextResponse.json({ error: "email send failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, emailSent: true });
}

function parseFields(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}
