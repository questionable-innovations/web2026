import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { emailOtps } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const Body = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad input" }, { status: 400 });

  const row = (
    await db.select().from(emailOtps).where(eq(emailOtps.email, parsed.data.email)).limit(1)
  )[0];
  if (!row || row.expiresAt < new Date()) {
    return NextResponse.json({ error: "expired" }, { status: 400 });
  }
  const codeHash = createHash("sha256").update(parsed.data.code).digest("hex");
  if (codeHash !== row.codeHash) {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  await db.delete(emailOtps).where(eq(emailOtps.email, parsed.data.email));
  return NextResponse.json({ ok: true });
}
