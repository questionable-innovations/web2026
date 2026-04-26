import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { attestations, contracts } from "@/server/db/schema";
import { readEscrow, serverPublicClient } from "@/lib/server-chain";
import { escrowAbi } from "@/lib/contracts/abis";
import { appendAuditCertificate, type AuditCertEvent } from "@/lib/audit-cert";
import { fetchPdfFromCid } from "@/lib/ipfs-gateway";

export type BuildCertResult = {
  pdf: Uint8Array;
  filename: string;
  state: string;
};

/// Build the audit certificate PDF on demand from current on-chain state +
/// off-chain attestations. Shared between the GET-on-demand route and the
/// pin-on-release route so the PDF the user downloads pre-pinning is byte-
/// identical to the one stored in IPFS afterwards.
export async function buildAuditCertificate(
  address: `0x${string}`,
): Promise<BuildCertResult> {
  const lower = address.toLowerCase();
  const row = (
    await db
      .select()
      .from(contracts)
      .where(eq(contracts.escrowAddress, lower))
      .limit(1)
  )[0];
  if (!row) throw new CertError("not found", 404);

  const onchain = await readEscrow(address).catch(() => null);
  if (!onchain) throw new CertError("escrow not deployed", 409);

  const sigs = await db
    .select()
    .from(attestations)
    .where(eq(attestations.contractId, row.id));

  const partyA = sigs.find(
    (s) => s.wallet.toLowerCase() === onchain.partyA.toLowerCase(),
  );
  const partyB = sigs.find(
    (s) => s.wallet.toLowerCase() === onchain.partyB.toLowerCase(),
  );
  if (!partyA || !partyB) {
    throw new CertError("missing attestations for one or both parties", 409);
  }

  const cid = row.signedPdfCid ?? row.pdfCid;
  const buf = await fetchPdfFromCid(cid).catch(() => {
    throw new CertError("ipfs fetch failed", 502);
  });

  const events = await collectLifecycle(address);

  const stamped = await appendAuditCertificate(buf, {
    title: row.title,
    escrowAddress: address,
    pdfHash: row.pdfHash as `0x${string}`,
    amount: row.depositAmount,
    tokenSymbol: process.env.NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL ?? "dNZD",
    state: onchain.state,
    signers: [
      {
        role: "Party A",
        name: partyA.name,
        email: partyA.email,
        wallet: onchain.partyA,
        attestationHash: partyA.attestationHash as `0x${string}`,
        signedAtUnix: signedAtUnix(partyA.signedAt),
      },
      {
        role: "Party B",
        name: partyB.name,
        email: partyB.email,
        wallet: onchain.partyB,
        attestationHash: partyB.attestationHash as `0x${string}`,
        signedAtUnix: signedAtUnix(partyB.signedAt),
      },
    ],
    events,
  });

  return {
    pdf: stamped,
    filename: `audit-${address.slice(0, 10)}.pdf`,
    state: onchain.state,
  };
}

export class CertError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function signedAtUnix(value: unknown): number {
  if (value instanceof Date) return Math.floor(value.getTime() / 1000);
  if (typeof value === "number") return value;
  return Math.floor(Date.now() / 1000);
}

async function collectLifecycle(
  address: `0x${string}`,
): Promise<AuditCertEvent[]> {
  const out: AuditCertEvent[] = [];
  const eventNames = ["Released", "Withdrawn", "Disputed"] as const;
  for (const name of eventNames) {
    try {
      const logs = await serverPublicClient.getContractEvents({
        address,
        abi: escrowAbi,
        eventName: name,
        fromBlock: "earliest",
        toBlock: "latest",
      });
      for (const log of logs) {
        out.push({
          label: name,
          value: `tx ${log.transactionHash} · block ${log.blockNumber}`,
        });
      }
    } catch {
      // best-effort
    }
  }
  return out;
}
