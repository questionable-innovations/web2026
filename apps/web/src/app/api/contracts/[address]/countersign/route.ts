import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { contracts, attestations } from "@/server/db/schema";
import { readEscrow, type OnchainEscrow } from "@/lib/server-chain";

const Body = z.object({
  partyB: z.object({
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    name: z.string().min(1),
    email: z.string().email(),
    attestationHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  }),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const lower = address.toLowerCase();
  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const partyB = parsed.data.partyB;

  // Verify on-chain that this wallet really is partyB and the countersign
  // tx landed before persisting to the index. The client only POSTs after
  // its own waitForTransactionReceipt resolves, so the tx is mined - but
  // our RPC may be a block behind the wallet's RPC, returning a stale
  // pre-countersign state. Poll briefly for propagation rather than 409'ing
  // the user back to a failed-error UI for a transient lag.
  let onchain = await readEscrow(address as `0x${string}`).catch(() => null);
  for (
    let attempt = 0;
    attempt < 4 && stateLooksStale(onchain);
    attempt++
  ) {
    await new Promise((r) => setTimeout(r, 500));
    onchain = await readEscrow(address as `0x${string}`).catch(() => onchain);
  }
  if (!onchain) {
    return NextResponse.json(
      { error: "escrow not deployed" },
      { status: 409 },
    );
  }
  if (onchain.partyB.toLowerCase() !== partyB.wallet.toLowerCase()) {
    return NextResponse.json(
      { error: "partyB mismatch" },
      { status: 409 },
    );
  }
  // Active is the immediate post-countersign state, but the deal may have
  // moved on (Releasing/Released/Disputed/Closed) by the time this lands -
  // accept anything past AwaitingCounterparty.
  if (onchain.state === "AwaitingCounterparty" || onchain.state === "Draft") {
    return NextResponse.json(
      { error: `escrow not yet countersigned (${onchain.state})` },
      { status: 409 },
    );
  }

  await db
    .update(contracts)
    .set({
      partyBWallet: partyB.wallet.toLowerCase(),
      state: onchain.state,
    })
    .where(eq(contracts.id, row.id));

  // Idempotent: the client retries this POST through transient failures, so
  // a second landing must not pile up duplicate attestation rows for the
  // same (contract, wallet) pair.
  const wallet = partyB.wallet.toLowerCase();
  const existing = (
    await db
      .select({ id: attestations.id })
      .from(attestations)
      .where(
        and(
          eq(attestations.contractId, row.id),
          eq(attestations.wallet, wallet),
        ),
      )
      .limit(1)
  )[0];
  if (!existing) {
    await db.insert(attestations).values({
      id: randomUUID(),
      contractId: row.id,
      wallet,
      name: partyB.name,
      email: partyB.email,
      attestationHash: partyB.attestationHash,
    });
  }

  return NextResponse.json({ ok: true });
}

function stateLooksStale(onchain: OnchainEscrow | null): boolean {
  if (!onchain) return true;
  return onchain.state === "AwaitingCounterparty" || onchain.state === "Draft";
}
