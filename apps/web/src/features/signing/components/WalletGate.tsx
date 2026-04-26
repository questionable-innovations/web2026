"use client";

import { ReactNode, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useConnect } from "wagmi";
import type { Connector } from "wagmi";
import { useLoginWithOAuth, usePrivy } from "@privy-io/react-auth";
import { useActiveWallet } from "@/lib/active-wallet";
import { isLocalhost } from "@/lib/isLocalhost";

/// Gate for any flow that requires a connected wallet. Renders a sign-in
/// surface if the user isn't connected, then hands the address down to the
/// children. This is the only place in the app that asks "are you signed in?"
/// - every downstream step assumes the wallet is established.
export function WalletGate({
  children,
  title = "Sign in to seal a deal",
  blurb = "DealSeal is wallet-first. Your wallet is your identity, your signature, and the source of your reputation. Pick one method below; every option leads to the same desk.",
}: {
  children: (address: `0x${string}`) => ReactNode;
  title?: string;
  blurb?: string;
}) {
  const { address, isConnected } = useActiveWallet();
  const { connect, connectors, isPending, variables, error } = useConnect();
  const [embeddedPendingKey, setEmbeddedPendingKey] = useState<string | null>(
    null,
  );
  const [embeddedError, setEmbeddedError] = useState<string | null>(null);
  const pendingConnectorUid = isPending
    ? (variables as { connector?: Connector } | undefined)?.connector?.uid
    : undefined;
  const privy = useSafePrivy();
  const loginWithOAuth = useSafeLoginWithOAuth();
  // When Privy is mounted it owns the wagmi connection state. Calling
  // wagmi's connect() directly makes the wallet flash in and then get
  // torn down because Privy has no session for it. Route external wallet
  // connects through privy.connectWallet() instead.
  const hasInjected =
    typeof window !== "undefined" &&
    (window as { ethereum?: unknown }).ethereum !== undefined;
  const showRawErrors = isLocalhost();

  if (isConnected && address) {
    return <>{children(address)}</>;
  }

  const hasPrivy = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID && privy;

  // Drop the privy connector - that's surfaced through the dedicated embedded
  // button, not as a generic wallet.
  const wallets = connectors.filter(
    (c) => c.id !== "privy" && c.type !== "privy",
  );

  // Wagmi auto-discovers wallets via EIP-6963 in addition to the generic
  // `injected()` connector configured in lib/wagmi. When announced wallets
  // exist, the generic one is strictly worse (non-deterministic, no name, no
  // icon) - hide it. Keep it only as a last-resort fallback.
  const announced = wallets.filter((c) => c.id !== "injected");
  const visibleWallets = announced.length > 0 ? announced : wallets;

  const methods: MethodOption[] = [
    ...(hasPrivy
      ? [
          {
            kind: "embedded" as const,
            key: "privy-email",
            name: "Email",
            tag: "EMBEDDED · created on first sign-in",
            onSelect: () => {
              void runEmbeddedLogin("privy-email", async () => {
                await privy?.login();
              });
            },
            isPending: embeddedPendingKey === "privy-email",
          },
          {
            kind: "embedded" as const,
            key: "privy-google",
            name: "Google",
            tag: "OAUTH · sign in with Google",
            onSelect: () => {
              void runEmbeddedLogin("privy-google", async () => {
                if (loginWithOAuth?.initOAuth) {
                  try {
                    await loginWithOAuth.initOAuth({ provider: "google" });
                    return;
                  } catch (err) {
                    console.error("Privy Google OAuth init failed", err);
                    // Fallback to the default Privy modal flow if direct OAuth
                    // init fails (eg provider config mismatch).
                  }
                }
                if (!privy?.login) {
                  throw new Error("Google OAuth is not available");
                }
                await privy.login();
              });
            },
            isPending: embeddedPendingKey === "privy-google",
          },
        ]
      : []),
    // Privy build: one tile that opens Privy's wallet picker. Privy enumerates
    // EIP-6963 providers itself and binds the connection to its session, which
    // is required when @privy-io/wagmi is mounted - calling wagmi's connect()
    // directly here lets the wallet attach for a frame and then get cleared.
    ...(hasPrivy
      ? [
          {
            kind: "embedded" as const,
            key: "privy-wallet",
            name: "Browser wallet",
            tag: hasInjected
              ? "EXTERNAL · MetaMask, Rabby, Coinbase…"
              : "EXTERNAL · WalletConnect QR",
            onSelect: () => {
              void runEmbeddedLogin("privy-wallet", async () => {
                if (!privy?.connectWallet) {
                  throw new Error("Wallet connect is not available");
                }
                await privy.connectWallet();
              });
            },
            isPending: embeddedPendingKey === "privy-wallet",
          },
        ]
      : visibleWallets.map((c) => ({
          kind: "wallet" as const,
          key: c.uid,
          name: c.name,
          tag: describeWalletConnector(c),
          icon: resolveIcon(c),
          onSelect: () => connect({ connector: c }),
          isPending: pendingConnectorUid === c.uid,
        }))),
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      <div className="border border-rule bg-card p-9">
        <div className="ds-eyebrow mb-4 flex items-center gap-3">
          <span>Step 0 · Identity</span>
          <span className="h-px flex-1 bg-rule" />
          <span className="text-muted">{pad2(methods.length)} options</span>
        </div>

        <div className="mb-5 h-[2px] w-9 bg-accent" aria-hidden />

        <h2
          className="font-serif font-normal"
          style={{ fontSize: 38, lineHeight: 1.05, letterSpacing: -0.7 }}
        >
          {title}
        </h2>
        <p
          className="mt-3 max-w-md leading-relaxed text-ink/70"
          style={{ fontSize: 15 }}
        >
          {blurb}
        </p>

        <div className="mt-9">
          <div className="ds-eyebrow mb-3 flex items-center gap-3">
            <span>Available methods</span>
            <span className="h-px flex-1 bg-rule" />
          </div>

          {methods.length === 0 ? (
            <EmptyState />
          ) : (
            <ul
              role="list"
              className="border-y border-rule"
              style={{ borderColor: "var(--color-rule)" }}
            >
              {methods.map((m, idx) => (
                <MethodRow
                  key={m.key}
                  serial={pad2(idx + 1)}
                  method={m}
                  isFirst={idx === 0}
                />
              ))}
            </ul>
          )}

          {(error || embeddedError) && (
            <p
              className="mt-4 font-mono text-accent"
              style={{ fontSize: 11, letterSpacing: 0.04 }}
            >
              {showRawErrors
                ? (embeddedError ?? error?.message ?? "An error occurred.")
                : "An error occurred."}
            </p>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Why wallet-first?</div>
          <ul
            className="space-y-2 leading-relaxed text-ink/75"
            style={{ fontSize: 14 }}
          >
            <li className="grid grid-cols-[14px_1fr] gap-2">
              <span className="font-mono text-muted" style={{ fontSize: 10 }}>
                §1
              </span>
              <span>
                Your signature <em>is</em> the binding act. No server-issued
                account stands between you and the contract.
              </span>
            </li>
            <li className="grid grid-cols-[14px_1fr] gap-2">
              <span className="font-mono text-muted" style={{ fontSize: 10 }}>
                §2
              </span>
              <span>
                Reputation accrues to your wallet: visible, portable, never
                tied to LinkedIn.
              </span>
            </li>
            <li className="grid grid-cols-[14px_1fr] gap-2">
              <span className="font-mono text-muted" style={{ fontSize: 10 }}>
                §3
              </span>
              <span>We never custody your funds or your keys.</span>
            </li>
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
          <ol
            className="mt-2 font-mono"
            style={{ fontSize: 11, lineHeight: 1.7 }}
          >
            <li>1 · sign in with wallet</li>
            <li>2 · upload PDF, set deposit</li>
            <li>3 · verify name + email (audit cert)</li>
            <li>4 · sign + deploy escrow · one tx</li>
          </ol>
        </div>
      </aside>
    </div>
  );

  async function runEmbeddedLogin(
    key: string,
    action: () => Promise<void>,
  ): Promise<void> {
    setEmbeddedError(null);
    setEmbeddedPendingKey(key);
    try {
      await action();
    } catch (err) {
      console.error("Embedded wallet login failed", err);
      setEmbeddedError(
        err instanceof Error ? err.message : "Something went wrong",
      );
    } finally {
      setEmbeddedPendingKey(null);
    }
  }
}

type MethodOption =
  | {
      kind: "embedded";
      key: string;
      name: string;
      tag: string;
      onSelect: () => void;
      isPending: boolean;
    }
  | {
      kind: "wallet";
      key: string;
      name: string;
      tag: string;
      icon: string | null;
      onSelect: () => void;
      isPending: boolean;
    };

function MethodRow({
  serial,
  method,
  isFirst,
}: {
  serial: string;
  method: MethodOption;
  isFirst: boolean;
}) {
  return (
    <li
      className={
        (isFirst ? "" : "border-t border-rule ") +
        "group relative transition-colors"
      }
    >
      <button
        type="button"
        onClick={method.onSelect}
        disabled={method.isPending}
        className="grid w-full grid-cols-[34px_44px_1fr_auto] items-center gap-4 px-1 py-4 text-left transition-all duration-200 ease-out hover:bg-paper-2/60 disabled:opacity-50"
      >
        <span
          aria-hidden
          className="absolute left-0 top-0 h-full w-[2px] origin-bottom scale-y-0 bg-accent transition-transform duration-300 ease-out group-hover:scale-y-100"
        />

        <span
          className="font-mono text-muted"
          style={{ fontSize: 11, letterSpacing: 0.08 }}
        >
          {serial}
        </span>

        <span className="flex h-11 w-11 items-center justify-center border border-rule bg-paper-2">
          {method.kind === "wallet" && method.icon ? (
            // Wagmi gives us a data: URL or http URL. Render directly.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={method.icon}
              alt=""
              width={26}
              height={26}
              className="rounded-[4px]"
              style={{ imageRendering: "auto" }}
            />
          ) : method.kind === "embedded" ? (
            <EmbeddedGlyph />
          ) : (
            <FallbackWalletGlyph name={method.name} />
          )}
        </span>

        <span className="min-w-0">
          <span
            className="block truncate font-semibold text-ink"
            style={{ fontSize: 14, letterSpacing: -0.1 }}
          >
            {method.name}
          </span>
          <span
            className="mt-1 block truncate font-mono text-muted"
            style={{ fontSize: 10.5, letterSpacing: 0.06 }}
          >
            {method.tag}
          </span>
        </span>

        <span className="flex items-center gap-3 pr-3">
          <span
            className="font-mono text-accent transition-transform duration-200 ease-out group-hover:translate-x-1"
            style={{ fontSize: 11, letterSpacing: 0.12 }}
          >
            {method.isPending ? "…" : method.kind === "embedded" ? "CONTINUE" : "CONNECT"}
          </span>
          <span
            className="text-accent transition-transform duration-200 ease-out group-hover:translate-x-2"
            aria-hidden
          >
            <ArrowRight size={14} />
          </span>
        </span>
      </button>
    </li>
  );
}

function EmptyState() {
  return (
    <div
      className="border border-dashed border-rule px-5 py-6 text-ink/70"
      style={{ fontSize: 13 }}
    >
      <div
        className="ds-eyebrow mb-2"
        style={{ color: "var(--color-accent)" }}
      >
        No methods available
      </div>
      <p>
        Install a browser wallet (MetaMask, Rabby, Core, Coinbase Wallet) or
        configure email sign-in by setting{" "}
        <code className="font-mono" style={{ fontSize: 12 }}>
          NEXT_PUBLIC_PRIVY_APP_ID
        </code>
        .
      </p>
    </div>
  );
}

function EmbeddedGlyph() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <rect
        x="2.5"
        y="5"
        width="17"
        height="12"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path
        d="M2.5 6 11 12l8.5-6"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <circle
        cx="16.5"
        cy="5"
        r="2.5"
        fill="var(--color-accent)"
        stroke="var(--color-paper-2)"
        strokeWidth="1"
      />
    </svg>
  );
}

function FallbackWalletGlyph({ name }: { name: string }) {
  const initial = (name || "·").trim().charAt(0).toUpperCase();
  return (
    <span
      className="flex h-6 w-6 items-center justify-center font-serif text-ink"
      style={{ fontSize: 16, lineHeight: 1 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function describeWalletConnector(c: Connector): string {
  if (c.id === "injected") {
    return "FALLBACK · uses window.ethereum";
  }
  const rdns = Array.isArray(c.rdns) ? c.rdns[0] : c.rdns;
  if (rdns) return `${rdns} · DETECTED`;
  return `${c.type.toUpperCase()} · DETECTED`;
}

function resolveIcon(c: Connector): string | null {
  return typeof c.icon === "string" && c.icon.length > 0 ? c.icon : null;
}

function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/// Privy throws if its provider isn't mounted. We render with bare wagmi
/// when NEXT_PUBLIC_PRIVY_APP_ID is unset, so guard the hook to avoid that.
function useSafePrivy() {
  try {
    return usePrivy();
  } catch (err) {
    console.error("usePrivy hook unavailable", err);
    return null;
  }
}

function useSafeLoginWithOAuth() {
  try {
    return useLoginWithOAuth();
  } catch (err) {
    console.error("useLoginWithOAuth hook unavailable", err);
    return null;
  }
}
