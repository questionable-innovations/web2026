import { NextResponse } from "next/server";
import { z } from "zod";
import { eq, or, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts, userProfiles } from "@/server/db/schema";
import { tierOf, type ValueTier } from "@/features/reputation/lib/tiers";
import { forwardResolve, looksLikeEnsName, reverseResolve } from "@/lib/ens";

const Wallet = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

type RoleStats = {
  completed: number;
  disputed: number;
  active: number;
};

function emptyRoleStats(): RoleStats {
  return { completed: 0, disputed: 0, active: 0 };
}

function rate(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 1000) / 10;
}

// Public reputation endpoint - explicitly excludes anything that would leak a
// counterparty or raw deal value. See project.md §3.6: counts can be public,
// raw amounts and counterparties cannot. Per-contract entries here only carry
// what's safe to show on a public profile (state, sealed-at, banded tier).
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ wallet: string }> },
) {
  const { wallet: raw } = await ctx.params;
  const decoded = decodeURIComponent(raw);

  // Accept either a 0x address or an ENS name. ENS names get forward-resolved
  // against mainnet; reputation aggregation is still keyed on the address so
  // we don't double-count if a name moves wallets.
  let wallet: string;
  let ensFromPath: string | null = null;
  if (looksLikeEnsName(decoded)) {
    const resolved = await forwardResolve(decoded);
    if (!resolved) {
      return NextResponse.json(
        { error: `ENS name ${decoded} doesn't resolve` },
        { status: 404 },
      );
    }
    wallet = resolved.toLowerCase();
    ensFromPath = decoded.toLowerCase();
  } else {
    const parsed = Wallet.safeParse(decoded);
    if (!parsed.success) {
      return NextResponse.json({ error: "bad wallet" }, { status: 400 });
    }
    wallet = parsed.data.toLowerCase();
  }

  const rows = await db
    .select({
      state: contracts.state,
      depositAmount: contracts.depositAmount,
      createdAt: contracts.createdAt,
      partyAWallet: contracts.partyAWallet,
      partyBWallet: contracts.partyBWallet,
    })
    .from(contracts)
    .where(
      or(eq(contracts.partyAWallet, wallet), eq(contracts.partyBWallet, wallet)),
    )
    .orderBy(asc(contracts.createdAt));

  let completed = 0;
  let disputed = 0;
  let active = 0;
  let completedValueNzd = 0;
  let firstSeen: Date | null = null;
  const issuer = emptyRoleStats();
  const counterparty = emptyRoleStats();

  type PublicEntry = {
    sealedAt: number; // unix seconds
    state: string;
    role: "issuer" | "counterparty";
    valueTier: ValueTier;
  };
  const history: PublicEntry[] = [];

  for (const r of rows) {
    const amount = Number(r.depositAmount || 0);
    const ts =
      r.createdAt instanceof Date
        ? Math.floor(r.createdAt.getTime() / 1000)
        : Number(r.createdAt);

    const isPostCountersign =
      r.state === "Active" ||
      r.state === "Releasing" ||
      r.state === "Released" ||
      r.state === "Closed" ||
      r.state === "Disputed" ||
      r.state === "Rescued";
    if (!isPostCountersign) continue;

    if (firstSeen === null || (r.createdAt as Date) < firstSeen) {
      firstSeen =
        r.createdAt instanceof Date ? r.createdAt : new Date(ts * 1000);
    }

    const roleKey =
      r.partyAWallet.toLowerCase() === wallet ? "issuer" : "counterparty";
    const roleStats = roleKey === "issuer" ? issuer : counterparty;

    if (r.state === "Released" || r.state === "Closed") {
      completed++;
      roleStats.completed++;
      completedValueNzd += amount;
    } else if (r.state === "Disputed") {
      disputed++;
      roleStats.disputed++;
    } else if (r.state === "Active" || r.state === "Releasing") {
      active++;
      roleStats.active++;
    }
    // Rescued is intentionally counted in neither bucket - matches §4.2.

    history.push({
      sealedAt: ts,
      state: r.state,
      role: roleKey,
      valueTier: tierOf(amount),
    });
  }

  const totalCounted = completed + disputed;
  const disputeRate = rate(disputed, totalCounted);
  const completionRate = rate(completed, totalCounted);
  const issuerTotal = issuer.completed + issuer.disputed;
  const counterpartyTotal = counterparty.completed + counterparty.disputed;

  // Display name comes from userProfiles if the wallet has registered one.
  // Email is captured but never returned on the public endpoint.
  const [profile, ensName] = await Promise.all([
    db
      .select({ name: userProfiles.name })
      .from(userProfiles)
      .where(eq(userProfiles.wallet, wallet))
      .limit(1)
      .then((rows) => rows[0]),
    ensFromPath
      ? Promise.resolve(ensFromPath)
      : reverseResolve(wallet as `0x${string}`),
  ]);

  return NextResponse.json({
    wallet,
    displayName: profile?.name ?? null,
    ensName,
    stats: {
      completed,
      disputed,
      active,
      completionRate, // percentage, one decimal
      disputeRate, // percentage, one decimal
      valueTier: tierOf(completedValueNzd),
      firstSeen: firstSeen ? Math.floor(firstSeen.getTime() / 1000) : null,
      roles: {
        issuer: {
          ...issuer,
          completionRate: rate(issuer.completed, issuerTotal),
          disputeRate: rate(issuer.disputed, issuerTotal),
        },
        counterparty: {
          ...counterparty,
          completionRate: rate(counterparty.completed, counterpartyTotal),
          disputeRate: rate(counterparty.disputed, counterpartyTotal),
        },
      },
    },
    // Newest first for display.
    history: history.sort((a, b) => b.sealedAt - a.sealedAt),
  });
}
