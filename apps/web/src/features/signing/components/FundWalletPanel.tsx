"use client";

import { useState } from "react";
import { ArrowUpRight, AlertTriangle, Check, RefreshCw } from "lucide-react";
import { formatUnits } from "viem";
import { useBalance, useReadContract } from "wagmi";
import { activeChain } from "@/lib/chain";
import { erc20Abi } from "@/lib/contracts/abis";

/// Shown to Party B on the sign & deposit screen when their balance is below
/// the required deposit. Surfaces the receiving address, the gap to fill, and
/// chain-appropriate paths to top up (faucet on testnet, onramp on mainnet).
/// Self-refreshes when the user clicks Refresh; React Query re-runs the
/// balance reads so the page can advance once funded.
export function FundWalletPanel({
  wallet,
  needed,
  tokenAddress,
  symbol,
  decimals,
  refetchBalance,
}: {
  wallet: `0x${string}`;
  needed: bigint;
  tokenAddress: `0x${string}`;
  symbol: string;
  decimals: number;
  refetchBalance: () => Promise<unknown>;
}) {
  const [copied, setCopied] = useState<"addr" | "token" | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isTestnet = activeChain.testnet === true;

  const native = useBalance({ address: wallet, chainId: activeChain.id });
  const erc20 = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });

  const have = (erc20.data as bigint | undefined) ?? 0n;
  const gap = needed > have ? needed - have : 0n;

  async function copy(value: string, kind: "addr" | "token") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1400);
    } catch (err) {
      console.error("Clipboard copy failed", err);
    }
  }

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([refetchBalance(), erc20.refetch(), native.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="border border-accent bg-ink-card p-5">
      <div className="flex items-baseline justify-between">
        <div
          className="inline-flex items-center gap-1.5 font-mono uppercase text-accent"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          <AlertTriangle size={12} strokeWidth={2.2} />
          Top up to deposit
        </div>
        <span
          className="font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {activeChain.name}
        </span>
      </div>

      <div
        className="mt-2 font-serif text-paper"
        style={{ fontSize: 26, lineHeight: 1.15, letterSpacing: -0.4 }}
      >
        Send {formatUnits(gap, decimals)} {symbol} to your wallet.
      </div>
      <p
        className="mt-1.5 font-mono text-ink-soft"
        style={{ fontSize: 11, lineHeight: 1.6 }}
      >
        Balance {formatUnits(have, decimals)} {symbol} · need{" "}
        {formatUnits(needed, decimals)} {symbol}
      </p>

      <div
        className="mt-4 grid grid-cols-1 gap-2.5"
        style={{ gridTemplateColumns: "1fr" }}
      >
        <FundRow
          label="Your address"
          value={wallet}
          copyValue={wallet}
          copied={copied === "addr"}
          onCopy={() => copy(wallet, "addr")}
        />
        <FundRow
          label={`${symbol} contract`}
          value={tokenAddress}
          copyValue={tokenAddress}
          copied={copied === "token"}
          onCopy={() => copy(tokenAddress, "token")}
          hint="Add to wallet, then Import token"
        />
      </div>

      {isTestnet ? (
        <TestnetFunding wallet={wallet} symbol={symbol} />
      ) : (
        <MainnetFunding symbol={symbol} />
      )}

      <div className="mt-4 flex items-center justify-between border-t border-ink-rule-soft pt-3">
        <span
          className="font-mono text-ink-muted"
          style={{ fontSize: 10 }}
        >
          Once funds arrive, hit refresh; the deposit button unlocks.
        </span>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 border border-ink-rule px-3.5 py-2 font-mono uppercase text-paper transition-colors hover:bg-ink-rule-soft disabled:opacity-60"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {refreshing ? (
            "Checking…"
          ) : (
            <>
              Refresh balance
              <RefreshCw size={11} strokeWidth={2} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function FundRow({
  label,
  value,
  copyValue,
  copied,
  onCopy,
  hint,
}: {
  label: string;
  value: string;
  copyValue: string;
  copied: boolean;
  onCopy: () => void;
  hint?: string;
}) {
  return (
    <div className="border border-ink-rule px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="font-mono uppercase text-accent"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {copied ? (
            <span className="inline-flex items-center gap-1">
              Copied
              <Check size={10} strokeWidth={2.5} />
            </span>
          ) : (
            "Copy"
          )}
        </button>
      </div>
      <code
        className="mt-1 block break-all font-mono text-paper"
        style={{ fontSize: 11, lineHeight: 1.4 }}
        title={copyValue}
      >
        {value}
      </code>
      {hint && (
        <div
          className="mt-1 font-mono text-ink-muted"
          style={{ fontSize: 10 }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function TestnetFunding({
  wallet,
  symbol,
}: {
  wallet: `0x${string}`;
  symbol: string;
}) {
  return (
    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
      <FundLink
        title="Get test AVAX"
        subtitle="Avalanche Fuji faucet"
        href={`https://core.app/tools/testnet-faucet/?subnet=c&token=c&address=${wallet}`}
      />
      <FundLink
        title={`Get test ${symbol}`}
        subtitle="Ask the team; request test tokens in Discord"
        href="https://faucet.avax.network/"
      />
    </div>
  );
}

function MainnetFunding({ symbol }: { symbol: string }) {
  return (
    <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
      <FundLink
        title={`Buy ${symbol}`}
        subtitle="Trade on Trader Joe (Avalanche)"
        href="https://traderjoexyz.com/avalanche/trade"
      />
      <FundLink
        title="On-ramp AVAX"
        subtitle="Card to wallet via MoonPay"
        href="https://buy.moonpay.com/?defaultCurrencyCode=avax"
      />
    </div>
  );
}

function FundLink({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center justify-between border border-ink-rule px-3.5 py-3 transition-colors hover:border-accent hover:bg-ink-rule-soft"
    >
      <span>
        <span
          className="block text-paper"
          style={{ fontSize: 13, fontWeight: 500 }}
        >
          {title}
        </span>
        <span
          className="mt-0.5 block font-mono text-ink-muted"
          style={{ fontSize: 10 }}
        >
          {subtitle}
        </span>
      </span>
      <span
        aria-hidden
        className="text-accent transition-transform group-hover:translate-x-0.5"
      >
        <ArrowUpRight size={14} />
      </span>
    </a>
  );
}
