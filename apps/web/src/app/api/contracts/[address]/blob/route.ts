import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const wantSigned = new URL(req.url).searchParams.get("signed") === "1";

  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());

  const lower = address.toLowerCase();
  const result = await db
    .update(contracts)
    .set(wantSigned ? { signedPdfBlob: buffer } : { pdfBlob: buffer })
    .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
    .returning({ id: contracts.id });
  if (result.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, bytes: buffer.byteLength });
}
