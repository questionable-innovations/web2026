import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { attestations, contracts } from "@/server/db/schema";
import { readEscrow } from "@/lib/server-chain";

/// Live snapshot of release-relevant on-chain state plus the off-chain
/// metadata (party names + emails) needed to render the page. The release
/// page polls this every few seconds so both signers see each other's
/// approvals land without a manual refresh.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const lower = address.toLowerCase();

  // This endpoint is polled — explicitly skip the blob columns so we don't
  // pull megabytes of PDF bytes into memory on every tick.
  const row = (
    await db
      .select({
        id: contracts.id,
        title: contracts.title,
        pdfHash: contracts.pdfHash,
        pdfCid: contracts.pdfCid,
        signedPdfCid: contracts.signedPdfCid,
        depositToken: contracts.depositToken,
        fieldsJson: contracts.fieldsJson,
      })
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

  const sigs = await db
    .select()
    .from(attestations)
    .where(eq(attestations.contractId, row.id));

  function profileFor(wallet: string | null) {
    if (!wallet) return { name: null, email: null };
    const lower = wallet.toLowerCase();
    const a = sigs.find((s) => s.wallet.toLowerCase() === lower);
    return { name: a?.name ?? null, email: a?.email ?? null };
  }

  const ZERO = "0x0000000000000000000000000000000000000000";
  const partyB = onchain.partyB === ZERO ? null : onchain.partyB;

  let fields: Record<string, unknown> = {};
  try {
    fields = JSON.parse(row.fieldsJson) as Record<string, unknown>;
  } catch {
    fields = {};
  }
  const auditCertCid =
    typeof fields.auditCertCid === "string" ? fields.auditCertCid : null;

  return NextResponse.json({
    escrowAddress: address,
    title: row.title,
    state: onchain.state,
    amount: onchain.amount.toString(),
    depositToken: row.depositToken,
    pdfHash: row.pdfHash,
    pdfCid: row.pdfCid,
    signedPdfCid: row.signedPdfCid,
    auditCertCid,
    partyA: {
      wallet: onchain.partyA,
      ...profileFor(onchain.partyA),
    },
    partyB: partyB
      ? {
          wallet: partyB,
          ...profileFor(partyB),
        }
      : null,
    proposedReleaseBy:
      onchain.proposedReleaseBy === ZERO ? null : onchain.proposedReleaseBy,
    withdrawable: onchain.withdrawable.toString(),
    disputedBy: onchain.disputedBy === ZERO ? null : onchain.disputedBy,
    disputeReason: onchain.disputeReason || null,
  });
}
