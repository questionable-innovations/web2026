import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { randomUUID } from "node:crypto";

const Body = z.object({
  title: z.string().min(1),
  counterpartyEmail: z.string().email(),
  amount: z.string().regex(/^\d+(\.\d+)?$/),
  pdfHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  pdfCid: z.string().min(1),
  partyAWallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/).optional(),
});

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = randomUUID();
  await db.insert(contracts).values({
    id,
    title: parsed.data.title,
    pdfCid: parsed.data.pdfCid,
    pdfHash: parsed.data.pdfHash,
    partyAWallet: parsed.data.partyAWallet ?? "0x0",
    depositToken: process.env.NEXT_PUBLIC_DEPOSIT_TOKEN ?? "0x0",
    depositAmount: parsed.data.amount,
  });
  return NextResponse.json({ id });
}
