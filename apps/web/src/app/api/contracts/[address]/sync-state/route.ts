import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { readEscrow } from "@/lib/server-chain";

/// Idempotent: re-read the escrow on-chain and mirror the state into the
/// off-chain index. Called after any state-changing tx the client submits
/// (releaseToA, refundToB, withdraw, flagDispute, cancelDispute) so the
/// contracts dashboard reflects the latest state without a separate indexer.
export async function POST(
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

  const onchain = await readEscrow(address as `0x${string}`).catch(() => null);
  if (!onchain) {
    return NextResponse.json(
      { error: "escrow not deployed" },
      { status: 409 },
    );
  }

  await db
    .update(contracts)
    .set({ state: onchain.state })
    .where(eq(contracts.id, row.id));

  return NextResponse.json({ ok: true, state: onchain.state });
}
