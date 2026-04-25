import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { contracts, attestations } from "@/server/db/schema";

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
  await db
    .update(contracts)
    .set({
      partyBWallet: partyB.wallet.toLowerCase(),
      state: "Active",
    })
    .where(eq(contracts.id, row.id));

  await db.insert(attestations).values({
    id: randomUUID(),
    contractId: row.id,
    wallet: partyB.wallet.toLowerCase(),
    name: partyB.name,
    email: partyB.email,
    attestationHash: partyB.attestationHash,
  });

  return NextResponse.json({ ok: true });
}
