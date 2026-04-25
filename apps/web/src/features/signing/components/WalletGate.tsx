"use client";

import { ReactNode } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";

/// Gate for any flow that requires a connected wallet. Renders a sign-in
/// surface if the user isn't connected, then hands the address down to the
/// children. This is the only place in the app that asks "are you signed in?"
/// — every downstream step assumes the wallet is established.
export function WalletGate({
  children,
  title = "Sign in to start sealing",
  blurb = "DealSeal is wallet-first. Your wallet is your identity, your signature, and the source of your reputation. Pick how you'd like to sign in.",
}: {
  children: (address: `0x${string}`) => ReactNode;
  title?: string;
  blurb?: string;
}) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const privy = useSafePrivy();

  if (isConnected && address) {
    return <>{children(address)}</>;
  }

  const hasPrivy = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID && privy;
  const injectedConnectors = connectors.filter(
    (c) => c.id !== "privy" && c.type !== "privy",
  );

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="border border-rule bg-card p-9">
        <div className="ds-eyebrow mb-2">Step 0 · Identity</div>
        <h2
          className="font-serif font-normal"
          style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: -0.7 }}
        >
          {title}
        </h2>
        <p
          className="mt-3 max-w-md leading-relaxed text-ink/70"
          style={{ fontSize: 15 }}
        >
          {blurb}
        </p>

        <div className="mt-7 space-y-3">
          {hasPrivy && (
            <button
              type="button"
              onClick={() => privy?.login()}
              className="flex w-full items-center justify-between bg-ink px-5 py-4 text-paper"
            >
              <div className="text-left">
                <div className="font-semibold" style={{ fontSize: 14 }}>
                  Sign in with email or Google
                </div>
                <div
                  className="mt-1 font-mono opacity-80"
                  style={{ fontSize: 11 }}
                >
                  Embedded wallet · created on first sign-in
                </div>
              </div>
              <span className="font-mono text-accent" style={{ fontSize: 11 }}>
                CONTINUE →
              </span>
            </button>
          )}

          {injectedConnectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector: c })}
              className="flex w-full items-center justify-between border border-rule bg-paper px-5 py-4 disabled:opacity-50"
            >
              <div className="text-left">
                <div className="font-semibold" style={{ fontSize: 14 }}>
                  {c.name}
                </div>
                <div
                  className="mt-1 font-mono text-muted"
                  style={{ fontSize: 11 }}
                >
                  Existing wallet · MetaMask, Rabby, Core, …
                </div>
              </div>
              <span className="font-mono text-accent" style={{ fontSize: 11 }}>
                {isPending ? "…" : "CONNECT →"}
              </span>
            </button>
          ))}

          {!hasPrivy && injectedConnectors.length === 0 && (
            <p className="font-mono text-accent" style={{ fontSize: 11 }}>
              No wallet connectors configured. Set{" "}
              <code>NEXT_PUBLIC_PRIVY_APP_ID</code> or install a browser
              wallet.
            </p>
          )}

          {error && (
            <p className="font-mono text-accent" style={{ fontSize: 11 }}>
              {error.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Why wallet-first?</div>
          <ul
            className="list-disc pl-5 leading-relaxed text-ink/75"
            style={{ fontSize: 14 }}
          >
            <li>Your signature *is* the binding act. No server-issued account stands between you and the contract.</li>
            <li>Your reputation accrues to your wallet — visible, portable, never tied to LinkedIn.</li>
            <li>We never custody your funds or your keys.</li>
          </ul>
        </div>
        <div className="bg-ink p-5 text-paper">
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            What happens next
          </div>
          <div
            className="mt-2 font-mono"
            style={{ fontSize: 11, lineHeight: 1.7 }}
          >
            <div>1 · sign in with wallet</div>
            <div>2 · upload PDF, set deposit</div>
            <div>3 · verify name + email (audit cert)</div>
            <div>4 · sign + deploy escrow · one tx</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/// Shared wallet badge for app shells. Connected → short addr + disconnect;
/// disconnected → "Sign in" link to the new flow that requires sign-in
/// anyway.
export function WalletBadge() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const privy = useSafePrivy();

  if (!isConnected || !address) {
    return (
      <a
        href="/new"
        className="bg-ink px-4 py-2.5 text-[13px] text-paper"
        style={{ letterSpacing: 0.3 }}
      >
        Sign in →
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-[11px] text-muted">
        {address.slice(0, 6)}…{address.slice(-4)}
      </span>
      <button
        type="button"
        onClick={() => {
          if (privy?.authenticated) privy.logout();
          disconnect();
        }}
        className="font-mono text-[10px] text-accent"
        style={{ letterSpacing: 1 }}
      >
        SIGN OUT
      </button>
    </div>
  );
}

/// Privy throws if its provider isn't mounted. We render with bare wagmi
/// when NEXT_PUBLIC_PRIVY_APP_ID is unset, so guard the hook to avoid that.
function useSafePrivy() {
  try {
    return usePrivy();
  } catch {
    return null;
  }
}
