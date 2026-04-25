"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type DirectoryEntry = {
  wallet: string;
  displayName: string | null;
  lastSeen: number;
  contractCount: number;
};

const HEX = /^0x[0-9a-fA-F]{40}$/;

export function LookupPanel() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/reputation")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setDirectory(d.wallets ?? []);
        setLoading(false);
      })
      .catch(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (!HEX.test(v)) {
      setError("Enter a 0x… wallet address (40 hex chars).");
      return;
    }
    setError(null);
    router.push(`/b/${v.toLowerCase()}`);
  }

  return (
    <div className="px-16 py-10">
      <div className="mb-10 flex items-baseline justify-between">
        <div>
          <div
            className="font-mono uppercase text-muted"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Public reputation · directory
          </div>
          <h1
            className="mt-3 font-serif font-normal"
            style={{ fontSize: 56, lineHeight: 1, letterSpacing: -1.2 }}
          >
            Look up a wallet.
          </h1>
          <p
            className="mt-4 max-w-xl leading-relaxed text-ink/75"
            style={{ fontSize: 16 }}
          >
            Profiles surface counts and tier-banded value across both the
            issuer and counterparty roles. Counterparties, raw amounts, PDF
            contents, and email addresses never appear here.
          </p>
        </div>
      </div>

      <form
        onSubmit={submit}
        className="mb-10 grid items-stretch border border-rule bg-card"
        style={{ gridTemplateColumns: "1fr auto" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x…"
          className="bg-transparent px-5 py-4 font-mono outline-none"
          style={{ fontSize: 14, letterSpacing: 0.5 }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          className="bg-ink px-6 text-paper"
          style={{ fontSize: 13, letterSpacing: 0.3 }}
        >
          View profile →
        </button>
      </form>
      {error && (
        <div
          className="-mt-7 mb-10 font-mono text-accent"
          style={{ fontSize: 12, letterSpacing: 0.5 }}
        >
          {error}
        </div>
      )}

      <div className="border border-rule bg-card">
        <div
          className="grid border-b border-rule px-6 py-3 font-mono uppercase text-muted"
          style={{
            gridTemplateColumns: "1.2fr 2fr 1fr 1fr 0.6fr",
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          <span>Display name</span>
          <span>Wallet</span>
          <span>Sealed</span>
          <span>Last activity</span>
          <span />
        </div>
        {loading && (
          <div className="px-6 py-8 text-sm text-muted">Loading directory…</div>
        )}
        {!loading && directory.length === 0 && (
          <div className="px-6 py-8 text-sm text-muted">
            No countersigned contracts yet on this network — once a deal
            advances past <span className="font-mono">Active</span>, the
            wallets show up here.
          </div>
        )}
        {directory.map((w, i) => (
          <Link
            key={w.wallet}
            href={`/b/${w.wallet}`}
            className="grid items-center px-6 py-4 hover:bg-paper"
            style={{
              gridTemplateColumns: "1.2fr 2fr 1fr 1fr 0.6fr",
              borderBottom:
                i < directory.length - 1
                  ? "1px solid var(--color-rule-soft)"
                  : "none",
              fontSize: 13,
            }}
          >
            <span className="font-serif" style={{ fontSize: 16 }}>
              {w.displayName ?? <span className="text-muted">—</span>}
            </span>
            <span
              className="font-mono text-muted"
              style={{ fontSize: 12, letterSpacing: 0.4 }}
            >
              {w.wallet}
            </span>
            <span className="font-mono" style={{ fontSize: 12 }}>
              {w.contractCount}
            </span>
            <span className="font-mono text-muted" style={{ fontSize: 11 }}>
              {formatDate(w.lastSeen)}
            </span>
            <span
              className="text-right font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              VIEW →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function formatDate(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}
