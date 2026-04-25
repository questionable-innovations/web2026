import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { readEscrow } from "@/lib/server-chain";

const Body = z.object({
  signedPdfCid: z.string().min(1),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const lower = address.toLowerCase();

  // Confirm the escrow exists on-chain. The stamped PDF is a best-effort
  // audit copy keyed off the escrow address, so the address must be real
  // before we link a CID against it.
  const onchain = await readEscrow(address as `0x${string}`).catch(
    () => null,
  );
  if (!onchain) {
    return NextResponse.json(
      { error: "escrow not deployed" },
      { status: 409 },
    );
  }

  const result = await db
    .update(contracts)
    .set({ signedPdfCid: parsed.data.signedPdfCid })
    .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
    .returning({ id: contracts.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
