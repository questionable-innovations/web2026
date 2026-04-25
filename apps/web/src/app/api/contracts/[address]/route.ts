import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";

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
  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  let fields: Record<string, unknown> = {};
  try {
    fields = JSON.parse(row.fieldsJson) as Record<string, unknown>;
  } catch {
    fields = {};
  }
  const counterpartyEmail = (fields.counterpartyEmail as string) ?? null;

  return NextResponse.json({
    id: row.id,
    escrowAddress: row.escrowAddress,
    title: row.title,
    pdfCid: row.pdfCid,
    pdfHash: row.pdfHash,
    signedPdfCid: row.signedPdfCid,
    partyAWallet: row.partyAWallet,
    partyAName: (fields.partyAName as string) ?? null,
    counterpartyEmailMasked: counterpartyEmail ? maskEmail(counterpartyEmail) : null,
    counterpartyName: (fields.counterpartyName as string) ?? null,
    depositToken: row.depositToken,
    depositAmount: row.depositAmount,
    totalDue: row.totalDue,
    dealDeadline: (fields.dealDeadline as number) ?? null,
    state: row.state,
    createdAt: row.createdAt,
  });
}
