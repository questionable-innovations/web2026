import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, address), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const wantSigned = new URL(req.url).searchParams.get("signed") === "1";
  const cid =
    wantSigned && row.signedPdfCid ? row.signedPdfCid : row.pdfCid;
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
  const upstream = await fetch(`${gateway}${cid}`);
  if (!upstream.ok) {
    return NextResponse.json({ error: "ipfs fetch failed" }, { status: 502 });
  }
  return new NextResponse(upstream.body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, max-age=60",
    },
  });
}
