import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { pinata } from "@/lib/ipfs";
import { buildAuditCertificate, CertError } from "@/lib/certificate";

/// GET — return the audit certificate PDF. If we've already pinned one for
/// this escrow, redirect to the gateway URL (immutable archival per §11.2);
/// otherwise build it on demand from current on-chain state.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const row = await loadRow(address);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields = parseFields(row.fieldsJson);
  const cached = typeof fields.auditCertCid === "string"
    ? fields.auditCertCid
    : null;
  if (cached) {
    const gateway =
      process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";
    return NextResponse.redirect(`${gateway}${cached}`, 302);
  }

  try {
    const built = await buildAuditCertificate(address as `0x${string}`);
    return new NextResponse(toBlob(built.pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `inline; filename="${built.filename}"`,
        "cache-control": "private, no-cache",
      },
    });
  } catch (err) {
    if (err instanceof CertError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}

/// POST — pin the certificate to IPFS. Idempotent: if `auditCertCid` is
/// already set in fieldsJson, returns it without rebuilding. Triggered by
/// the client once the escrow reaches Released so the cert is preserved
/// even if the off-chain DB later disappears.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params;
  const row = await loadRow(address);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const fields = parseFields(row.fieldsJson);
  if (typeof fields.auditCertCid === "string" && fields.auditCertCid) {
    return NextResponse.json({ cid: fields.auditCertCid, cached: true });
  }

  if (!pinata) {
    return NextResponse.json(
      { error: "PINATA_JWT not configured" },
      { status: 503 },
    );
  }

  let built;
  try {
    built = await buildAuditCertificate(address as `0x${string}`);
  } catch (err) {
    if (err instanceof CertError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  // Only pin once the escrow has actually reached a release-terminal state —
  // otherwise we'd archive a half-baked lifecycle and never refresh it.
  if (built.state !== "Released" && built.state !== "Closed") {
    return NextResponse.json(
      { error: `escrow not yet released (${built.state})` },
      { status: 409 },
    );
  }

  const blob = new Blob([new Uint8Array(built.pdf)], {
    type: "application/pdf",
  });
  const file = new File([blob], built.filename, { type: "application/pdf" });
  const uploaded = await pinata.upload.file(file);

  const merged = { ...fields, auditCertCid: uploaded.cid };
  await db
    .update(contracts)
    .set({ fieldsJson: JSON.stringify(merged) })
    .where(eq(contracts.id, row.id));

  return NextResponse.json({ cid: uploaded.cid, cached: false });
}

async function loadRow(address: string) {
  const lower = address.toLowerCase();
  return (
    await db
      .select()
      .from(contracts)
      .where(or(eq(contracts.escrowAddress, lower), eq(contracts.id, address)))
      .limit(1)
  )[0];
}

function parseFields(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function toBlob(bytes: Uint8Array): Blob {
  return new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
}
