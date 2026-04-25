import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { userProfiles } from "@/server/db/schema";

const Wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const Body = z.object({
  wallet: Wallet,
  name: z.string().min(1).max(120),
  email: z.string().email(),
});

export async function GET(req: Request) {
  const url = new URL(req.url);
  const wallet = url.searchParams.get("wallet");
  if (!wallet || !Wallet.safeParse(wallet).success) {
    return NextResponse.json({ error: "bad wallet" }, { status: 400 });
  }
  const row = (
    await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.wallet, wallet.toLowerCase()))
      .limit(1)
  )[0];
  return NextResponse.json({
    profile: row
      ? { wallet: row.wallet, name: row.name, email: row.email }
      : null,
  });
}

export async function PUT(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { wallet, name, email } = parsed.data;
  const lower = wallet.toLowerCase();
  await db
    .insert(userProfiles)
    .values({ wallet: lower, name: name.trim(), email })
    .onConflictDoUpdate({
      target: userProfiles.wallet,
      set: {
        name: name.trim(),
        email,
        updatedAt: sql`(unixepoch())`,
      },
    });
  return NextResponse.json({
    profile: { wallet: lower, name: name.trim(), email },
  });
}
