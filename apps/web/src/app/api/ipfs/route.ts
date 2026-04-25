import { NextResponse } from "next/server";
import { pinPdf } from "@/lib/ipfs";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const fd = await req.formData();
  const file = fd.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  try {
    const { cid } = await pinPdf(file, file.name || "contract.pdf");
    return NextResponse.json({ cid });
  } catch (err) {
    const message = err instanceof Error ? err.message : "upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
