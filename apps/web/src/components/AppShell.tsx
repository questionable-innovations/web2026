"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useAccount } from "wagmi";

export type ContractState =
  | "Draft"
  | "Awaiting B"
  | "Active"
  | "Releasing"
  | "Released"
  | "Disputed";

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <Link
      href="/"
      className="font-serif text-ink"
      style={{ fontSize: size, letterSpacing: -0.4, lineHeight: 1 }}
    >
      DealSeal
    </Link>
  );
}

export function AppNav({
  active,
  wallet: walletProp,
}: {
  active?: "contracts" | "create" | "reputation" | "settings";
  wallet?: string;
}) {
  const { address } = useAccount();
  const wallet = walletProp ?? address;
  const items: { k: NonNullable<typeof active>; label: string; href: string }[] = [
    { k: "contracts", label: "Contracts", href: "/contracts" },
    { k: "create", label: "New", href: "/new" },
    {
      k: "reputation",
      label: "Reputation",
      href: wallet ? `/b/${wallet}` : "/#reputation",
    },
    { k: "settings", label: "Settings", href: "/settings" },
  ];
  return (
    <header className="flex items-center justify-between border-b border-rule bg-paper px-7 py-3.5">
      <div className="flex items-center gap-7">
        <BrandMark />
        <nav className="flex gap-[22px] text-[13px]">
          {items.map((it) => {
            const isActive = it.k === active;
            return (
              <Link
                key={it.k}
                href={it.href}
                className="pb-1"
                style={{
                  color: isActive ? "var(--color-ink)" : "var(--color-muted)",
                  borderBottom: `1.5px solid ${isActive ? "var(--color-accent)" : "transparent"}`,
                }}
              >
                {it.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3.5">
        <span className="font-mono text-[11px] text-muted">
          {wallet ? `${wallet.slice(0, 6)}…${wallet.slice(-4)}` : "not connected"}
        </span>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-serif text-[11px] text-paper">
          {wallet ? wallet.slice(2, 3).toUpperCase() : "·"}
        </span>
      </div>
    </header>
  );
}

const stateMap: Record<ContractState, { bg: string; fg: string }> = {
  Draft: { bg: "rgba(10,10,10,0.078)", fg: "var(--color-ink)" },
  "Awaiting B": { bg: "var(--color-accent-soft)", fg: "var(--color-accent)" },
  Active: { bg: "var(--color-green-soft)", fg: "var(--color-green)" },
  Releasing: { bg: "var(--color-amber-soft)", fg: "var(--color-amber)" },
  Released: { bg: "var(--color-ink)", fg: "var(--color-paper)" },
  Disputed: { bg: "var(--color-accent)", fg: "#fff" },
};

export function StateBadge({ state }: { state: string }) {
  const style = stateMap[(state as ContractState)] ?? stateMap.Draft;
  return (
    <span
      className="font-mono uppercase"
      style={{
        background: style.bg,
        color: style.fg,
        fontSize: 10,
        letterSpacing: 1,
        padding: "4px 10px",
      }}
    >
      {state}
    </span>
  );
}

export function Seal({ size = 64 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-32 -32 64 64" aria-hidden>
      <circle r="28" fill="var(--color-accent)" />
      <text
        x="0"
        y="3"
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#fff"
        fontFamily="var(--font-serif)"
        fontStyle="italic"
        fontSize="22"
      >
        DS
      </text>
    </svg>
  );
}

export function PdfThumb({ height = 200, title = "Services Agreement", heading = "Engagement of services" }: { height?: number; title?: string; heading?: string }) {
  const lines = [100, 92, 96, 88, 100, 70, 84, 96, 80, 92, 76, 84, 96];
  return (
    <div
      className="border border-rule bg-card font-mono"
      style={{ padding: "14px 16px", height, overflow: "hidden", fontSize: 7, color: "var(--color-ink)" }}
    >
      <div className="ds-eyebrow" style={{ fontSize: 6 }}>{title}</div>
      <div style={{ height: 6 }} />
      <div className="font-serif" style={{ fontSize: 13, lineHeight: 1.1 }}>{heading}</div>
      <div style={{ height: 10 }} />
      {lines.map((w, i) => (
        <div
          key={i}
          style={{
            height: 2.5,
            background: "rgba(10,10,10,0.07)",
            marginBottom: 3.5,
            width: `${w}%`,
          }}
        />
      ))}
    </div>
  );
}

export function PageShell({ children, active, wallet }: { children: ReactNode; active?: "contracts" | "create" | "reputation" | "settings"; wallet?: string }) {
  return (
    <div className="min-h-screen bg-paper">
      <AppNav active={active} wallet={wallet} />
      {children}
    </div>
  );
}
