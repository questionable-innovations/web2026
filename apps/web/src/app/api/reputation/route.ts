import { NextResponse } from "next/server";
import { sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, userProfiles } from "@/server/db/schema";

const ACTIVE_STATES = [
  "Active",
  "Releasing",
  "Released",
  "Closed",
  "Disputed",
] as const;

// Lists wallets with at least one post-countersign contract, sorted by
// most-recent activity. Used by the /b lookup landing as a directory of
// profiles a viewer can drill into. Counterparty wallets and raw amounts are
// not returned — only the wallet itself, its registered display name (if any),
// and a count of contracts surfaced. Same privacy posture as the per-wallet
// endpoint.
export async function GET() {
  const rows = await db
    .select({
      wallet: contracts.partyAWallet,
      lastSeen: sql<number>`max(unixepoch(${contracts.createdAt}))`.as(
        "last_seen",
      ),
      contractCount: sql<number>`count(*)`.as("contract_count"),
    })
    .from(contracts)
    .where(inArray(contracts.state, [...ACTIVE_STATES]))
    .groupBy(contracts.partyAWallet)
    .orderBy(sql`last_seen desc`)
    .limit(24);

  // Also include wallets that only ever appeared as Party B.
  const partyBRows = await db
    .select({
      wallet: contracts.partyBWallet,
      lastSeen: sql<number>`max(unixepoch(${contracts.createdAt}))`.as(
        "last_seen",
      ),
      contractCount: sql<number>`count(*)`.as("contract_count"),
    })
    .from(contracts)
    .where(
      sql`${contracts.partyBWallet} is not null and ${contracts.state} in ('Active','Releasing','Released','Closed','Disputed')`,
    )
    .groupBy(contracts.partyBWallet)
    .orderBy(sql`last_seen desc`)
    .limit(24);

  const merged = new Map<
    string,
    { wallet: string; lastSeen: number; contractCount: number }
  >();
  for (const r of [...rows, ...partyBRows]) {
    if (!r.wallet) continue;
    const w = r.wallet.toLowerCase();
    const prev = merged.get(w);
    if (!prev) {
      merged.set(w, {
        wallet: w,
        lastSeen: r.lastSeen,
        contractCount: r.contractCount,
      });
    } else {
      prev.lastSeen = Math.max(prev.lastSeen, r.lastSeen);
      prev.contractCount += r.contractCount;
    }
  }

  const wallets = [...merged.values()]
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, 12);

  const names = wallets.length
    ? await db
        .select({ wallet: userProfiles.wallet, name: userProfiles.name })
        .from(userProfiles)
        .where(
          inArray(
            userProfiles.wallet,
            wallets.map((w) => w.wallet),
          ),
        )
    : [];
  const nameByWallet = new Map(names.map((n) => [n.wallet, n.name]));

  return NextResponse.json({
    wallets: wallets.map((w) => ({
      wallet: w.wallet,
      displayName: nameByWallet.get(w.wallet) ?? null,
      lastSeen: w.lastSeen,
      contractCount: w.contractCount,
    })),
  });
}
