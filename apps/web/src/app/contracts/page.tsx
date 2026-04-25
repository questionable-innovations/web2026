import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";
import { PageShell, StateBadge } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const rows = await db
    .select()
    .from(contracts)
    .orderBy(desc(contracts.createdAt))
    .limit(50);

  const total = rows.length;
  const active = rows.filter((r) => r.state === "Active").length;
  const completed = rows.filter((r) => r.state === "Released").length;
  const disputed = rows.filter((r) => r.state === "Disputed").length;
  const inEscrow = rows
    .filter((r) => r.state === "Active" || r.state === "Releasing")
    .reduce((sum, r) => sum + Number(r.depositAmount || 0), 0);

  return (
    <PageShell active="contracts">
      <div className="px-9 py-8">
        <div className="mb-8 flex items-baseline justify-between">
          <div>
            <div className="ds-eyebrow">Your contracts</div>
            <h1
              className="mt-1.5 font-serif font-normal"
              style={{ fontSize: 44, lineHeight: 1.15, letterSpacing: -0.9 }}
            >
              {total} sealed.{" "}
              <em className="text-muted">{active} active.</em>
            </h1>
          </div>
          <Link href="/new" className="bg-ink px-5 py-3 text-[13px] text-paper">
            + New contract
          </Link>
        </div>

        <div
          className="mb-6 grid grid-cols-4 border border-rule"
          style={{ gap: 1, background: "var(--color-rule)" }}
        >
          {[
            [
              `$${inEscrow.toLocaleString()}`,
              "In escrow",
              "var(--color-accent)",
            ],
            [String(completed), "Completed", "var(--color-ink)"],
            [String(disputed), "Disputed", "var(--color-ink)"],
            ["18mo", "On platform", "var(--color-ink)"],
          ].map(([v, l, c]) => (
            <div key={l} className="bg-card px-5 py-4">
              <div
                className="font-serif"
                style={{ fontSize: 32, lineHeight: 1, color: c }}
              >
                {v}
              </div>
              <div
                className="mt-1 font-mono uppercase text-muted"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                {l}
              </div>
            </div>
          ))}
        </div>

        <div className="border border-rule bg-card">
          <div
            className="grid border-b border-rule px-6 py-3 font-mono uppercase text-muted"
            style={{
              gridTemplateColumns: "2.4fr 1.4fr 1fr 1fr 1fr 0.6fr",
              fontSize: 10,
              letterSpacing: 1,
            }}
          >
            <span>Title</span>
            <span>Counterparty</span>
            <span>Amount</span>
            <span>State</span>
            <span>Updated</span>
            <span />
          </div>
          {rows.length === 0 && (
            <div className="px-6 py-8 text-sm text-muted">
              No contracts yet.{" "}
              <Link className="text-accent" href="/new">
                Create one →
              </Link>
            </div>
          )}
          {rows.map((r, i) => (
            <Link
              key={r.id}
              href={`/c/${r.escrowAddress ?? r.id}`}
              className="grid items-center px-6 py-4 hover:bg-paper"
              style={{
                gridTemplateColumns: "2.4fr 1.4fr 1fr 1fr 1fr 0.6fr",
                borderBottom:
                  i < rows.length - 1
                    ? "1px solid var(--color-rule-soft)"
                    : "none",
                fontSize: 13,
              }}
            >
              <span className="font-serif" style={{ fontSize: 16 }}>
                {r.title}
              </span>
              <span className="font-mono text-muted" style={{ fontSize: 12 }}>
                {r.partyBWallet
                  ? `${r.partyBWallet.slice(0, 6)}…${r.partyBWallet.slice(-4)}`
                  : "pending…"}
              </span>
              <span className="font-mono" style={{ fontSize: 12 }}>
                ${Number(r.depositAmount || 0).toLocaleString()}
              </span>
              <span>
                <StateBadge state={r.state} />
              </span>
              <span className="font-mono text-muted" style={{ fontSize: 11 }}>
                {r.createdAt instanceof Date
                  ? r.createdAt.toISOString().slice(0, 10)
                  : new Date(Number(r.createdAt) * 1000)
                      .toISOString()
                      .slice(0, 10)}
              </span>
              <span
                className="text-right font-mono text-accent"
                style={{ fontSize: 11 }}
              >
                OPEN →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </PageShell>
  );
}
