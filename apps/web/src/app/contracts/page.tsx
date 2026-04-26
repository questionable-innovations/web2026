"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useAccount } from "wagmi";
import { PageShell, StateBadge } from "@/components/AppShell";
import { WalletGate } from "@/features/signing/components/WalletGate";

type Row = {
  id: string;
  escrowAddress: string | null;
  title: string;
  partyAWallet: string;
  partyBWallet: string | null;
  depositAmount: string;
  state: string;
  createdAt: number | string;
};

export default function ContractsPage() {
  return (
    <PageShell active="contracts">
      <div className="px-9 py-8">
        <WalletGate
          title="Sign in to see your contracts"
          blurb="Your contracts list is filtered to the wallet you sign in with: both deals you initiated and deals where you're the counterparty."
        >
          {(address) => <Inner wallet={address} />}
        </WalletGate>
      </div>
    </PageShell>
  );
}

function Inner({ wallet }: { wallet: `0x${string}` }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const account = useAccount();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/contracts?wallet=${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setRows((d.contracts ?? []) as Row[]);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const total = rows.length;
  const active = rows.filter((r) => r.state === "Active").length;
  const completed = rows.filter(
    (r) => r.state === "Released" || r.state === "Closed",
  ).length;
  const disputed = rows.filter((r) => r.state === "Disputed").length;
  const inEscrow = rows
    .filter(
      (r) =>
        r.state === "Active" ||
        r.state === "Released" ||
        r.state === "Disputed",
    )
    .reduce((sum, r) => sum + Number(r.depositAmount || 0), 0);

  return (
    <>
      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <div className="ds-eyebrow">
            Your contracts · {account.address?.slice(0, 6)}…
            {account.address?.slice(-4)}
          </div>
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
          [String(total), "Total", "var(--color-ink)"],
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
        {loading && (
          <div className="px-6 py-8 text-sm text-muted">Loading…</div>
        )}
        {!loading && rows.length === 0 && (
          <div className="px-6 py-8 text-sm text-muted">
            No contracts yet for this wallet.{" "}
            <Link className="inline-flex items-center gap-1 text-accent" href="/new">
              Create one
              <ArrowRight size={12} />
            </Link>
          </div>
        )}
        {rows.map((r, i) => {
          const isPartyA = r.partyAWallet.toLowerCase() === wallet.toLowerCase();
          const otherWallet = isPartyA ? r.partyBWallet : r.partyAWallet;
          return (
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
                {otherWallet
                  ? `${otherWallet.slice(0, 6)}…${otherWallet.slice(-4)}`
                  : "pending…"}
              </span>
              <span className="font-mono" style={{ fontSize: 12 }}>
                ${Number(r.depositAmount || 0).toLocaleString()}
              </span>
              <span>
                <StateBadge state={r.state} />
              </span>
              <span className="font-mono text-muted" style={{ fontSize: 11 }}>
                {formatDate(r.createdAt)}
              </span>
              <span
                className="inline-flex items-center justify-end gap-1 text-right font-mono text-accent"
                style={{ fontSize: 11 }}
              >
                {isPartyA ? "YOUR DEAL" : "SIGNED"}
                <ArrowRight size={12} />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}

function formatDate(t: number | string): string {
  const d =
    typeof t === "number"
      ? new Date(t * 1000)
      : /^\d+$/.test(t)
      ? new Date(Number(t) * 1000)
      : new Date(t);
  return d.toISOString().slice(0, 10);
}
