"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  TIER_LABEL,
  TIER_NAME,
  type ValueTier,
} from "@/features/reputation/lib/tiers";

type Stats = {
  completed: number;
  disputed: number;
  active: number;
  disputeRate: number;
  valueTier: ValueTier;
  firstSeen: number | null;
};

type HistoryEntry = {
  sealedAt: number;
  state: string;
  role: "issuer" | "counterparty";
  valueTier: ValueTier;
};

type Reputation = {
  wallet: string;
  displayName: string | null;
  stats: Stats;
  history: HistoryEntry[];
};

export function ReputationCard({ wallet }: { wallet: string }) {
  const [data, setData] = useState<Reputation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/reputation/${wallet}`)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error((await r.json()).error ?? `HTTP ${r.status}`);
        }
        return r.json();
      })
      .then((d: Reputation) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (cancelled) return;
        setError(e.message);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

  if (loading) {
    return (
      <div className="px-16 py-10 text-sm text-muted">
        Loading reputation for {short}…
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="px-16 py-10">
        <div className="mb-3 font-mono uppercase text-accent" style={{ fontSize: 11, letterSpacing: 2 }}>
          Lookup failed
        </div>
        <div className="font-serif" style={{ fontSize: 28 }}>
          Couldn&apos;t load profile for {short}.
        </div>
        <div className="mt-2 text-sm text-muted">{error}</div>
        <Link href="/b" className="mt-6 inline-block font-mono text-accent" style={{ fontSize: 12, letterSpacing: 0.5 }}>
          ← Back to directory
        </Link>
      </div>
    );
  }

  const { stats, history, displayName } = data;
  const firstSeenLabel = stats.firstSeen
    ? new Date(stats.firstSeen * 1000).toISOString().slice(0, 10)
    : "—";
  const tierName = TIER_NAME[stats.valueTier];

  return (
    <div className="px-16 py-7">
      <div className="mb-7 flex justify-end">
        <Link
          href="/b"
          className="font-mono uppercase text-muted hover:text-ink"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          ← Directory · /b/{short}
        </Link>
      </div>

      <div
        className="grid items-start gap-12"
        style={{ gridTemplateColumns: "1.2fr 1fr" }}
      >
        <div>
          <div
            className="font-mono uppercase text-accent"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Tier · {tierName}
          </div>
          <h1
            className="my-3 font-serif font-normal"
            style={{ fontSize: 72, lineHeight: 1.02, letterSpacing: -2 }}
          >
            {displayName ?? short}
          </h1>
          <div className="font-mono text-muted" style={{ fontSize: 12, letterSpacing: 0.4 }}>
            {wallet}
          </div>
          <div className="mt-2 text-base text-muted">
            First seen {firstSeenLabel} · Banded value tier {TIER_LABEL[stats.valueTier]}
          </div>

          <div
            className="mt-8 grid grid-cols-3 border border-rule"
            style={{ gap: 1, background: "var(--color-rule)" }}
          >
            {[
              [String(stats.completed), "Completed", "var(--color-accent)"],
              [String(stats.disputed), "Disputed", "var(--color-ink)"],
              [`${stats.disputeRate.toFixed(1)}%`, "Dispute rate", "var(--color-ink)"],
            ].map(([v, l, c]) => (
              <div key={l} className="bg-card px-5 py-6">
                <div
                  className="font-serif"
                  style={{ fontSize: 56, lineHeight: 1, color: c }}
                >
                  {v}
                </div>
                <div
                  className="mt-2 font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-rule bg-card">
            <div
              className="border-b border-rule px-6 py-3 font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              Sealed history · {history.length}
            </div>
            {history.length === 0 && (
              <div className="px-6 py-8 text-sm text-muted">
                No countersigned deals yet for this wallet.
              </div>
            )}
            {history.map((h, i) => (
              <div
                key={i}
                className="grid items-center px-6 py-3.5"
                style={{
                  gridTemplateColumns: "1fr 1.2fr 1.4fr 1.2fr",
                  borderBottom:
                    i < history.length - 1
                      ? "1px solid var(--color-rule-soft)"
                      : "none",
                  fontSize: 13,
                }}
              >
                <span className="font-mono" style={{ fontSize: 12 }}>
                  {new Date(h.sealedAt * 1000).toISOString().slice(0, 10)}
                </span>
                <span
                  className="font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {h.role === "issuer" ? "Issued" : "Countersigned"}
                </span>
                <span className="font-mono" style={{ fontSize: 12 }}>
                  {TIER_LABEL[h.valueTier]} tier
                </span>
                <span>
                  <StatePill state={h.state} />
                </span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="border border-rule bg-card p-6">
            <div
              className="mb-4 flex items-baseline justify-between"
            >
              <span
                className="font-mono uppercase text-muted"
                style={{ fontSize: 10, letterSpacing: 1.5 }}
              >
                How tiers work · banded, never raw
              </span>
              <span
                className="font-mono uppercase text-accent"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                Currently · {tierName}
              </span>
            </div>
            <div
              className="border border-rule"
              style={{ background: "var(--color-rule)", display: "grid", gap: 1 }}
            >
              {([1, 2, 3, 4] as const).map((t) => {
                const active = stats.valueTier === t;
                return (
                  <div
                    key={t}
                    className="grid items-center bg-card px-4 py-3"
                    style={{ gridTemplateColumns: "20px 1fr 110px" }}
                  >
                    <span
                      className="font-mono uppercase"
                      style={{
                        fontSize: 10,
                        letterSpacing: 1,
                        color: active ? "var(--color-accent)" : "var(--color-muted)",
                      }}
                    >
                      {t}
                    </span>
                    <span
                      className="font-serif"
                      style={{
                        fontSize: 18,
                        lineHeight: 1,
                        color: active ? "var(--color-accent)" : "var(--color-ink)",
                      }}
                    >
                      {TIER_NAME[t]}
                    </span>
                    <span
                      className="text-right font-mono text-muted"
                      style={{ fontSize: 12, lineHeight: 1 }}
                    >
                      {TIER_LABEL[t]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatePill({ state }: { state: string }) {
  const isGood = state === "Released" || state === "Closed";
  const isBad = state === "Disputed" || state === "Rescued";
  const bg = isGood
    ? "var(--color-green-soft)"
    : isBad
    ? "var(--color-accent-soft)"
    : "rgba(10,10,10,0.06)";
  const fg = isGood
    ? "var(--color-green)"
    : isBad
    ? "var(--color-accent)"
    : "var(--color-ink)";
  return (
    <span
      className="font-mono uppercase"
      style={{
        background: bg,
        color: fg,
        fontSize: 10,
        letterSpacing: 1,
        padding: "4px 10px",
      }}
    >
      {state}
    </span>
  );
}
