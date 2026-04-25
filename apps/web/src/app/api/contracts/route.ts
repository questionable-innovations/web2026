import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contracts, attestations } from "@/server/db/schema";
import { randomUUID } from "node:crypto";

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

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = randomUUID();
  const d = parsed.data;
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
