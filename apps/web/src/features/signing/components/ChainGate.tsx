"use client";

import { ReactNode } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { activeChain } from "@/lib/chain";

/// Render `children` only when the connected wallet is on the deployment
/// chain. Otherwise show a switch-network panel — without this, users get
/// silent EIP-712 sig failures (the domain separator's chainId won't match)
/// followed by a separate tx revert.
///
/// We key off `useAccount().chainId` (the *wallet's* connected chain), not
/// `useChainId()` (wagmi config's "current chain") — they can diverge mid-
/// switch, and the wallet's chain is what actually signs.
export function ChainGate({ children }: { children: ReactNode }) {
  const { chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (chainId === activeChain.id) {
    return <>{children}</>;
  }

  return (
    <div className="border border-rule bg-card p-7">
      <div className="ds-eyebrow mb-2">Wrong network</div>
      <h2
        className="font-serif font-normal"
        style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: -0.5 }}
      >
        Switch to {activeChain.name} to sign.
      </h2>
      <p
        className="mt-2.5 max-w-md leading-relaxed text-ink/70"
        style={{ fontSize: 14 }}
      >
        Your wallet is on chain {chainId}. DealSeal escrows live on{" "}
        {activeChain.name} (chain {activeChain.id}). Signatures bound to a
        different chainId will be rejected on-chain, so we won&apos;t prompt
        you yet.
      </p>
      <button
        type="button"
        disabled={isPending}
        onClick={() => switchChain({ chainId: activeChain.id })}
        className="mt-5 bg-ink px-5 py-3 text-paper disabled:opacity-50"
        style={{ fontSize: 13 }}
      >
        {isPending ? "Switching…" : `Switch to ${activeChain.name}`}
      </button>
      {error && (
        <p
          className="mt-3 font-mono text-accent"
          style={{ fontSize: 11 }}
        >
          {error.message}
        </p>
      )}
    </div>
  );
}
