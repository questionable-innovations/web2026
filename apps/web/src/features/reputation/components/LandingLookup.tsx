"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";

const HEX = /^0x[0-9a-fA-F]{40}$/;
const ENS = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function LandingLookup() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);

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
          setError(`${v} doesn't resolve on sepolia.`);
          return;
        }
        router.push(`/b/${encodeURIComponent(v.toLowerCase())}`);
      } catch {
        setError(`Couldn't reach ENS resolver. Try the 0x address.`);
      } finally {
        setResolving(false);
      }
      return;
    }
    setError("Enter a 0x… wallet address or an ENS name (e.g. vitalik.eth).");
  }

  return (
    <div className="border border-rule bg-card p-8">
      <div
        className="font-mono uppercase"
        style={{
          fontSize: 11,
          letterSpacing: 2,
          color: "var(--color-muted)",
        }}
      >
        Public lookup
      </div>
      <div
        className="mt-1.5 font-serif"
        style={{ fontSize: 32, lineHeight: 1.05 }}
      >
        Search any wallet.
      </div>
      <p
        className="mt-3 text-[14px] leading-relaxed text-ink/75"
      >
        ENS names resolve on Sepolia. Counterparties, raw amounts, and
        document contents never appear in public profiles.
      </p>

      <form
        onSubmit={submit}
        className="mt-6 grid items-stretch border border-rule bg-paper"
        style={{ gridTemplateColumns: "1fr auto" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="0x… or vitalik.eth"
          className="bg-transparent px-4 py-3.5 font-mono outline-none"
          style={{ fontSize: 13, letterSpacing: 0.4 }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          disabled={resolving}
          className="bg-ink px-5 text-paper disabled:opacity-60"
          style={{ fontSize: 12, letterSpacing: 0.3 }}
        >
          {resolving ? (
            "Resolving…"
          ) : (
            <span className="inline-flex items-center gap-1.5">
              Look up
              <ArrowRight size={13} />
            </span>
          )}
        </button>
      </form>
      {error && (
        <div
          className="mt-3 font-mono text-accent"
          style={{ fontSize: 12, letterSpacing: 0.4 }}
        >
          {error}
        </div>
      )}
      <div className="mt-4">
        <Link
          href="/b"
          className="inline-flex items-center gap-1.5 font-mono uppercase text-muted hover:text-ink"
          style={{ fontSize: 10, letterSpacing: 1.5 }}
        >
          Browse the directory
          <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
