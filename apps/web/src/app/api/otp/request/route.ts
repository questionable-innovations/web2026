import { NextResponse } from "next/server";
import { z } from "zod";
import { createHash, randomInt } from "node:crypto";
import { db } from "@/lib/db";
import { emailOtps } from "@/server/db/schema";
import { Resend } from "resend";
import { EmailTemplate } from '../request/email-temp';

const Body = z.object({ email: z.string().email() });


export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "bad email" }, { status: 400 });

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + 10 * 60_000);

  await db
    .insert(emailOtps)
    .values({ email: parsed.data.email, codeHash, expiresAt })
    .onConflictDoUpdate({
      target: emailOtps.email,
      set: { codeHash, expiresAt },
    });

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "noreply@example.com";
  console.log(
    `[otp] request email=${parsed.data.email} from=${from} hasApiKey=${!!apiKey} apiKeyLen=${apiKey?.length ?? 0}`,
  );

  if (apiKey) {
    const resend = new Resend(apiKey);

    try {
      const result = await resend.emails.send({
        from,
        to: parsed.data.email,
        subject: "Your one time code",
        react: EmailTemplate({ code }),
      });
      console.log(`[otp] resend response`, JSON.stringify(result));
      if (result.error) {
        return NextResponse.json(
          { error: "send failed", detail: result.error },
          { status: 502 },
        );
      }
    } catch (err) {
      console.error(`[otp] resend threw`, err);
      return NextResponse.json(
        {
          error: "send threw",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 502 },
      );
    }
  } else {
    console.log(`[dev] OTP for ${parsed.data.email}: ${code}`);
  }
  return NextResponse.json({ ok: true });
}
