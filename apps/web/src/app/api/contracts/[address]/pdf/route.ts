import { db } from "@/lib/db";
import { fetchPdfFromCid, IpfsFetchError } from "@/lib/ipfs-gateway";
import { readEscrow } from "@/lib/server-chain";
import { contracts } from "@/server/db/schema";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const lower = address.toLowerCase();
  const row = (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const wantSigned = new URL(req.url).searchParams.get("signed") === "1";
  const onchain = /^0x[0-9a-fA-F]{40}$/.test(address)
    ? await readEscrow(address as `0x${string}`).catch(() => null)
    : null;
  const chainPdfCid = onchain?.pdfCid;
  const cid = wantSigned && row.signedPdfCid
    ? row.signedPdfCid
    : chainPdfCid || row.pdfCid;

  let pdf: Uint8Array;
  try {
    pdf = await fetchPdfFromCid(cid);
  } catch (err) {
    return NextResponse.json(
      {
        error: "ipfs fetch failed",
        attempts: err instanceof IpfsFetchError ? err.attempts : undefined,
      },
      { status: 502 },
    );
  }
  const body = pdf.buffer.slice(
    pdf.byteOffset,
    pdf.byteOffset + pdf.byteLength,
  ) as ArrayBuffer;
  return new NextResponse(body, {
    headers: {
      "content-type": "application/pdf",
      "cache-control": "private, max-age=60",
    },
  });
}
