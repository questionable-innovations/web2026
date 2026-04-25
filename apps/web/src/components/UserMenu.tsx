"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useAccount,
  useBalance,
  useDisconnect,
  useReadContract,
} from "wagmi";
import { formatUnits } from "viem";
import { usePrivy } from "@privy-io/react-auth";
import { activeChain, depositToken } from "@/lib/chain";
import { erc20Abi } from "@/lib/contracts/abis";
import { useEnsName, shortAddress } from "@/lib/ens-client";

type Profile = { wallet: string; name: string; email: string };

/// Top-right user widget. Click the avatar to expand a popover with the
/// signed-in identity (name/email/wallet), live balances, quick links, and
/// sign-out. Falls back to a "Sign in" CTA if no wallet is connected.
export function UserMenu() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const privy = useSafePrivy();

  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  // Fetch the saved profile (name/email captured during ProfileGate). This is
  // the canonical name; Privy's google.name is a fallback when the user hasn't
  // completed ProfileGate yet.
  useEffect(() => {
    if (!address) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/profile?wallet=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setProfile(d.profile);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [address]);

  // Click-outside / Escape to close.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const native = useBalance({ address, chainId: activeChain.id });
  const erc20 = useReadContract({
    address: depositToken.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const privyEmail = privy?.user?.email?.address ?? null;
  const privyGoogle = privy?.user?.google ?? null;
  const ensName = useEnsName(address ?? null);
  const displayName =
    profile?.name ?? privyGoogle?.name ?? ensName ?? null;
  const displayEmail = profile?.email ?? privyEmail ?? privyGoogle?.email ?? null;

  const initial = useMemo(() => {
    const src = displayName || address || "·";
    return src.replace(/^0x/, "").trim().charAt(0).toUpperCase();
  }, [displayName, address]);

  const avatarColors = useMemo(() => avatarGradient(address ?? "0x0"), [address]);

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

  async function copyAddress() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // ignored
    }
  }

  function signOut() {
    if (privy?.authenticated) privy.logout();
    disconnect();
    setOpen(false);
  }

  const short = shortAddress(address);
  // The button shows the most-prominent identity at a glance: profile name if
  // they've registered one, else ENS, else the truncated 0x. The popover row
  // below shows the next layer of detail (ensName + short, or just short).
  const subtitle = ensName && profile?.name ? ensName : short;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2.5 border border-rule bg-card px-2.5 py-1.5 transition-colors hover:bg-paper-2"
      >
        <Avatar initial={initial} colors={avatarColors} />
        <span className="hidden flex-col items-start sm:flex">
          <span
            className="leading-tight text-ink"
            style={{ fontSize: 12, maxWidth: 120 }}
          >
            <span className="block truncate">
              {displayName ?? "Unverified"}
            </span>
          </span>
          <span
            className="font-mono text-muted"
            style={{ fontSize: 10, letterSpacing: 0.3 }}
          >
            {subtitle}
          </span>
        </span>
        <span
          aria-hidden
          className="font-mono text-muted"
          style={{ fontSize: 10 }}
        >
          {open ? "▴" : "▾"}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[320px] border border-rule bg-card shadow-xl"
          style={{ boxShadow: "0 12px 40px rgba(10,10,10,0.12)" }}
        >
          <div className="flex items-start gap-3 border-b border-rule px-4 pt-4 pb-3.5">
            <Avatar initial={initial} colors={avatarColors} size={40} />
            <div className="min-w-0 flex-1">
              <div
                className="truncate font-serif text-ink"
                style={{ fontSize: 16, lineHeight: 1.15 }}
              >
                {displayName ?? "Unverified user"}
              </div>
              <div
                className="mt-0.5 truncate text-muted"
                style={{ fontSize: 12 }}
              >
                {displayEmail ?? "No email on file"}
              </div>
              {!profile && (
                <Link
                  href="/settings"
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-block font-mono uppercase text-accent"
                  style={{ fontSize: 9, letterSpacing: 1 }}
                >
                  Add name & email →
                </Link>
              )}
            </div>
          </div>

          <div className="px-4 pt-3 pb-3">
            <div className="ds-eyebrow mb-1.5 flex items-center justify-between">
              <span>Wallet{ensName ? ` · ${ensName}` : ""}</span>
              <span className="text-muted" style={{ letterSpacing: 1 }}>
                {activeChain.name}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 bg-paper px-2.5 py-2">
              <code
                className="truncate font-mono text-ink"
                style={{ fontSize: 11 }}
                title={address}
              >
                {address}
              </code>
              <button
                type="button"
                onClick={copyAddress}
                className="font-mono uppercase text-accent"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px bg-rule">
            <BalanceCell
              label={depositToken.symbol}
              value={
                erc20.data !== undefined
                  ? formatUnits(erc20.data as bigint, depositToken.decimals)
                  : null
              }
            />
            <BalanceCell
              label={native.data?.symbol ?? "AVAX"}
              value={
                native.data
                  ? formatUnits(native.data.value, native.data.decimals)
                  : null
              }
            />
          </div>

          <nav className="border-t border-rule">
            <MenuLink href="/contracts" onClick={() => setOpen(false)}>
              My contracts
            </MenuLink>
            <MenuLink
              href={`/b/${ensName ? encodeURIComponent(ensName) : address}`}
              onClick={() => setOpen(false)}
            >
              My reputation
            </MenuLink>
            <MenuLink
              href={`https://testnet.snowtrace.io/address/${address}`}
              external
            >
              View on Snowtrace ↗
            </MenuLink>
            <MenuLink href="/settings" onClick={() => setOpen(false)}>
              Settings
            </MenuLink>
          </nav>

          <button
            type="button"
            onClick={signOut}
            className="block w-full border-t border-rule px-4 py-3 text-left font-mono uppercase text-accent transition-colors hover:bg-paper-2"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({
  href,
  children,
  onClick,
  external,
}: {
  href: string;
  children: React.ReactNode;
  onClick?: () => void;
  external?: boolean;
}) {
  const cls =
    "flex items-center justify-between border-b border-rule-soft px-4 py-2.5 text-ink transition-colors hover:bg-paper-2";
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} style={{ fontSize: 13 }}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} onClick={onClick} className={cls} style={{ fontSize: 13 }}>
      {children}
    </Link>
  );
}

function BalanceCell({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="bg-card px-4 py-2.5">
      <div
        className="font-mono uppercase text-muted"
        style={{ fontSize: 9, letterSpacing: 1 }}
      >
        {label}
      </div>
      <div
        className="mt-0.5 truncate font-serif text-ink"
        style={{ fontSize: 18, lineHeight: 1.15 }}
        title={value ?? undefined}
      >
        {value !== null ? formatBalance(value) : "—"}
      </div>
    </div>
  );
}

function Avatar({
  initial,
  colors,
  size = 28,
}: {
  initial: string;
  colors: { from: string; to: string };
  size?: number;
}) {
  return (
    <span
      className="flex items-center justify-center font-serif text-paper"
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: `linear-gradient(135deg, ${colors.from}, ${colors.to})`,
        fontSize: Math.round(size * 0.46),
        lineHeight: 1,
      }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

function formatBalance(s: string): string {
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  if (n === 0) return "0";
  if (n < 0.0001) return "< 0.0001";
  if (n >= 1000) return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return n.toLocaleString(undefined, { maximumFractionDigits: 4 });
}

function avatarGradient(seed: string): { from: string; to: string } {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const hue2 = (hue + 40) % 360;
  return {
    from: `hsl(${hue}, 60%, 38%)`,
    to: `hsl(${hue2}, 65%, 22%)`,
  };
}

function useSafePrivy() {
  try {
    return usePrivy();
  } catch {
    return null;
  }
}
