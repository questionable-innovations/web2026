import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, attestations } from "@/server/db/schema";
import { randomUUID } from "node:crypto";
import { readEscrow } from "@/lib/server-chain";

const Body = z.object({
  title: z.string().min(1),
  counterpartyEmail: z.string().email(),
  counterpartyName: z.string().min(1).optional(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  pdfHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  pdfCid: z.string().min(1),
  escrowAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  secretHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  dealDeadline: z.number().int().positive(),
  partyA: z.object({
    wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
    name: z.string().min(1),
    email: z.string().email(),
    attestationHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  }),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet")?.toLowerCase();
  const rows = wallet
    ? await db
        .select()
        .from(contracts)
        .where(
          or(
            eq(contracts.partyAWallet, wallet),
            eq(contracts.partyBWallet, wallet),
          ),
        )
        .orderBy(desc(contracts.createdAt))
        .limit(100)
    : await db
        .select()
        .from(contracts)
        .orderBy(desc(contracts.createdAt))
        .limit(100);
  return NextResponse.json({ contracts: rows });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const d = parsed.data;

  // Verify on-chain state matches the claim before persisting. Without this,
  // anyone could POST arbitrary metadata against any escrow address and
  // pollute the dashboard / "verified" badges.
  const onchain = await readEscrow(d.escrowAddress as `0x${string}`).catch(
    () => null,
  );
  if (!onchain) {
    return NextResponse.json(
      { error: "escrow not deployed" },
      { status: 409 },
    );
  }
  if (onchain.state !== "AwaitingCounterparty") {
    return NextResponse.json(
      { error: `escrow in unexpected state ${onchain.state}` },
      { status: 409 },
    );
  }
  if (onchain.partyA.toLowerCase() !== d.partyA.wallet.toLowerCase()) {
    return NextResponse.json(
      { error: "partyA mismatch" },
      { status: 409 },
    );
  }
  if (onchain.pdfHash.toLowerCase() !== d.pdfHash.toLowerCase()) {
    return NextResponse.json(
      { error: "pdfHash mismatch" },
      { status: 409 },
    );
  }

  const id = randomUUID();
  await db.insert(contracts).values({
    id,
    escrowAddress: d.escrowAddress.toLowerCase(),
    title: d.title,
    pdfCid: d.pdfCid,
    pdfHash: d.pdfHash,
    partyAWallet: d.partyA.wallet.toLowerCase(),
    depositToken: process.env.NEXT_PUBLIC_DEPOSIT_TOKEN ?? "0x0",
    depositAmount: d.amount,
    state: "AwaitingCounterparty",
    fieldsJson: JSON.stringify({
      counterpartyEmail: d.counterpartyEmail,
      counterpartyName: d.counterpartyName ?? null,
      partyAName: d.partyA.name,
      partyAEmail: d.partyA.email,
      secretHash: d.secretHash,
      dealDeadline: d.dealDeadline,
    }),
  });
  await db.insert(attestations).values({
    id: randomUUID(),
    contractId: id,
    wallet: d.partyA.wallet.toLowerCase(),
    name: d.partyA.name,
    email: d.partyA.email,
    attestationHash: d.partyA.attestationHash,
  });
  return NextResponse.json({ id, escrowAddress: d.escrowAddress });
}
