"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { pickAddressLabel, shortAddress } from "@/lib/ens-client";
import {
  EnsProfileCard,
  type EnsProfile,
} from "@/features/reputation/components/EnsProfileCard";

type DirectoryEntry = {
  wallet: string;
  displayName: string | null;
  ensName: string | null;
  lastSeen: number;
  contractCount: number;
};

const HEX = /^0x[0-9a-fA-F]{40}$/;
const ENS = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

type PreviewState =
  | { kind: "idle" }
  | { kind: "loading"; query: string }
  | { kind: "hit"; query: string; profile: EnsProfile }
  | { kind: "miss"; query: string };

export function LookupPanel() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [directory, setDirectory] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewState>({ kind: "idle" });
  const previewSeq = useRef(0);

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

  // Live ENS preview: as the user types `vitalik.eth`, debounce 300ms then
  // fetch the profile. We track a sequence number so a slow earlier request
  // can't overwrite a fresher response.
  useEffect(() => {
    const v = input.trim();
    if (!ENS.test(v)) {
      setPreview({ kind: "idle" });
      return;
    }
    const seq = ++previewSeq.current;
    setPreview({ kind: "loading", query: v });
    const t = setTimeout(async () => {
      try {
        const r = await fetch(
          `/api/ens?name=${encodeURIComponent(v)}&profile=1`,
        );
        const data = (await r.json()) as { profile: EnsProfile | null };
        if (seq !== previewSeq.current) return;
        if (!data.profile || !data.profile.address) {
          setPreview({ kind: "miss", query: v });
        } else {
          setPreview({ kind: "hit", query: v, profile: data.profile });
        }
      } catch {
        if (seq !== previewSeq.current) return;
        setPreview({ kind: "miss", query: v });
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const v = input.trim();
    if (HEX.test(v)) {
      setError(null);
      router.push(`/b/${v.toLowerCase()}`);
      return;
    }
    if (ENS.test(v)) {
      setError(null);
      setResolving(true);
      try {
        const r = await fetch(`/api/ens?name=${encodeURIComponent(v)}`);
        const data = (await r.json()) as { address: string | null };
        if (!data.address) {
          setError(`${v} doesn't resolve to an address.`);
          return;
        }
        // Navigate using the ENS name so the URL reads cleanly; the API
        // route will forward-resolve again before querying reputation.
        router.push(`/b/${encodeURIComponent(v.toLowerCase())}`);
      } catch {
        setError(`Couldn't reach ENS resolver. Try the 0x address.`);
      } finally {
        setResolving(false);
      }
      return;
    }
    setError("Enter a 0x… wallet address or an ENS name (e.g. dealseal.eth).");
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
          placeholder="0x… or vitalik.eth"
          className="bg-transparent px-5 py-4 font-mono outline-none"
          style={{ fontSize: 14, letterSpacing: 0.5 }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          disabled={resolving}
          className="bg-ink px-6 text-paper disabled:opacity-60"
          style={{ fontSize: 13, letterSpacing: 0.3 }}
        >
          {resolving ? (
            "Resolving…"
          ) : (
            <span className="inline-flex items-center gap-2">
              View profile
              <ArrowRight size={14} />
            </span>
          )}
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

      {preview.kind === "loading" && (
        <div className="mb-10 border border-rule bg-card px-5 py-4 font-mono text-muted" style={{ fontSize: 12 }}>
          Resolving {preview.query} on mainnet…
        </div>
      )}
      {preview.kind === "miss" && (
        <div className="mb-10 border border-rule bg-card px-5 py-4 font-mono text-muted" style={{ fontSize: 12 }}>
          {preview.query} doesn&apos;t resolve to an address on mainnet ENS.
        </div>
      )}
      {preview.kind === "hit" && (
        <div className="mb-10 grid items-stretch gap-0" style={{ gridTemplateColumns: "1fr auto" }}>
          <EnsProfileCard profile={preview.profile} />
          <button
            type="button"
            onClick={() =>
              router.push(`/b/${encodeURIComponent(preview.profile.name)}`)
            }
            className="border border-l-0 border-rule bg-ink px-6 text-paper hover:bg-accent"
            style={{ fontSize: 13, letterSpacing: 0.3 }}
          >
            <span className="inline-flex items-center gap-2">
              View reputation
              <ArrowRight size={14} />
            </span>
          </button>
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
            No countersigned contracts yet on this network. Once a deal
            advances past <span className="font-mono">Active</span>, the
            wallets show up here.
          </div>
        )}
        {directory.map((w, i) => {
          const label = pickAddressLabel({
            profileName: w.displayName,
            ensName: w.ensName,
            address: w.wallet,
          });
          const labelIsName = label !== shortAddress(w.wallet);
          const href = w.ensName
            ? `/b/${encodeURIComponent(w.ensName)}`
            : `/b/${w.wallet}`;
          return (
          <Link
            key={w.wallet}
            href={href}
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
              {labelIsName ? (
                label
              ) : (
                <span className="text-muted">-</span>
              )}
            </span>
            <span
              className="font-mono text-muted"
              style={{ fontSize: 12, letterSpacing: 0.4 }}
            >
              {w.ensName ? (
                <>
                  <span className="text-ink">{w.ensName}</span>
                  <span className="ml-2">{shortAddress(w.wallet)}</span>
                </>
              ) : (
                w.wallet
              )}
            </span>
            <span className="font-mono" style={{ fontSize: 12 }}>
              {w.contractCount}
            </span>
            <span className="font-mono text-muted" style={{ fontSize: 11 }}>
              {formatDate(w.lastSeen)}
            </span>
            <span
              className="inline-flex items-center justify-end gap-1 text-right font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              VIEW
              <ArrowRight size={12} />
            </span>
          </Link>
          );
        })}
      </div>
    </div>
  );
}

function formatDate(t: number): string {
  return new Date(t * 1000).toISOString().slice(0, 10);
}
