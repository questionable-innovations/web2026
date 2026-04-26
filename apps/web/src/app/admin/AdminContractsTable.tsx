"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Address, formatUnits, parseUnits } from "viem";
import { useReadContracts } from "wagmi";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Search,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { StateBadge } from "@/components/AppShell";
import {
  activeChain,
  DepositTokenConfig,
  depositTokens,
  getDepositTokenByAddress,
} from "@/lib/chain";

const aTokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

const AVALANCHE_MAINNET_AUSDC =
  "0x625E7708f30cA75bfd92586e17077590C60eb4cD" as Address;

const configuredAToken = process.env.NEXT_PUBLIC_AUSDC_TOKEN as
  | Address
  | undefined;
const aUsdcAddress =
  configuredAToken ??
  (activeChain.id === 43114 ? AVALANCHE_MAINNET_AUSDC : undefined);

type ContractData = {
  id: string;
  escrowAddress: string | null;
  title: string;
  depositAmount: string;
  depositToken: string;
  state: string;
  partyAWallet: string;
  partyBWallet: string | null;
  createdAt: string;
};

type DisplayRow = {
  contract: ContractData;
  token: DepositTokenConfig;
  principalRaw: bigint;
  aaveEligible: boolean;
  balanceRaw?: bigint;
  interestRaw: bigint;
  health: "not-funded" | "not-aave" | "loading" | "ok" | "shortfall";
};

const FUNDED_STATES = new Set(["Active", "Releasing", "Released", "Disputed"]);
const OPEN_STATES = new Set([
  "AwaitingCounterparty",
  "Active",
  "Releasing",
  "Released",
  "Disputed",
]);
const CLOSED_STATES = new Set(["Closed", "Rescued"]);

function shortAddress(value: string | null | undefined) {
  return value ? `${value.slice(0, 6)}...${value.slice(-4)}` : "Pending";
}

function parseAmount(value: string, decimals: number) {
  try {
    return parseUnits(value || "0", decimals);
  } catch {
    return 0n;
  }
}

function formatMoney(value: bigint, token: DepositTokenConfig, digits = 2) {
  const amount = Number(formatUnits(value, token.decimals));
  return `${amount.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })} ${token.symbol}`;
}

function formatAggregate(rows: DisplayRow[]) {
  const bySymbol = new Map<string, number>();
  for (const row of rows) {
    const current = bySymbol.get(row.token.symbol) ?? 0;
    bySymbol.set(
      row.token.symbol,
      current + Number(formatUnits(row.principalRaw, row.token.decimals)),
    );
  }
  const entries = [...bySymbol.entries()].filter(([, value]) => value > 0);
  if (entries.length === 0) return "0";
  if (entries.length > 2) return `${entries.length} tokens`;
  return entries
    .map(
      ([symbol, value]) =>
        `${value.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })} ${symbol}`,
    )
    .join(" / ");
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getStatusCopy(row: DisplayRow) {
  if (row.health === "not-aave") return "Not routed";
  if (row.health === "not-funded") return "Deposit pending";
  if (row.health === "loading") return "Reading";
  if (row.health === "shortfall") return "Shortfall";
  return "Accruing";
}

export function AdminContractsTable({
  contracts,
  loadError,
}: {
  contracts: ContractData[];
  loadError?: string | null;
}) {
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [tokenFilter, setTokenFilter] = useState("all");

  const aaveToken = depositTokens.find(
    (token) => token.symbol.toUpperCase() === "USDC",
  );
  const aaveSupportedTokenAddress = aaveToken?.address.toLowerCase();

  const wagmiCalls = useMemo(() => {
    return contracts.map((contract) => {
      const token = getDepositTokenByAddress(contract.depositToken);
      const aaveEligible =
        Boolean(aUsdcAddress) &&
        Boolean(contract.escrowAddress) &&
        token.address.toLowerCase() === aaveSupportedTokenAddress &&
        FUNDED_STATES.has(contract.state);

      return aaveEligible
        ? {
            address: aUsdcAddress,
            abi: aTokenAbi,
            functionName: "balanceOf",
            args: [contract.escrowAddress as Address],
          }
        : null;
    });
  }, [aaveSupportedTokenAddress, contracts]);

  const filteredCalls = useMemo(
    () => wagmiCalls.filter((call): call is NonNullable<typeof call> => call !== null),
    [wagmiCalls],
  );

  const { data: aTokenBalances, isLoading, isFetching, isError } =
    useReadContracts({
      contracts: filteredCalls,
      query: {
        enabled: filteredCalls.length > 0,
        refetchInterval: 10000,
      },
    });

  const usdcIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let balanceIndex = 0;
    wagmiCalls.forEach((call, contractIndex) => {
      if (call !== null) {
        map.set(contractIndex, balanceIndex);
        balanceIndex++;
      }
    });
    return map;
  }, [wagmiCalls]);

  const rows = useMemo<DisplayRow[]>(() => {
    return contracts.map((contract, index) => {
      const token = getDepositTokenByAddress(contract.depositToken);
      const principalRaw = parseAmount(contract.depositAmount, token.decimals);
      const balanceIdx = usdcIndexMap.get(index);
      const balanceRaw =
        balanceIdx !== undefined
          ? (aTokenBalances?.[balanceIdx]?.result as bigint | undefined)
          : undefined;
      const aaveEligible =
        balanceIdx !== undefined &&
        token.address.toLowerCase() === aaveSupportedTokenAddress;
      const interestRaw =
        balanceRaw && balanceRaw > principalRaw ? balanceRaw - principalRaw : 0n;
      const health: DisplayRow["health"] = !FUNDED_STATES.has(contract.state)
        ? "not-funded"
        : !aaveEligible
          ? "not-aave"
          : balanceRaw === undefined
            ? "loading"
            : balanceRaw < principalRaw
              ? "shortfall"
              : "ok";

      return {
        contract,
        token,
        principalRaw,
        aaveEligible,
        balanceRaw,
        interestRaw,
        health,
      };
    });
  }, [aTokenBalances, aaveSupportedTokenAddress, contracts, usdcIndexMap]);

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(({ contract, token }) => {
      const matchesQuery =
        needle.length === 0 ||
        [
          contract.id,
          contract.escrowAddress,
          contract.title,
          contract.partyAWallet,
          contract.partyBWallet,
          token.symbol,
          contract.state,
        ]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle));
      const matchesState =
        stateFilter === "all" ||
        (stateFilter === "open" && OPEN_STATES.has(contract.state)) ||
        (stateFilter === "closed" && CLOSED_STATES.has(contract.state)) ||
        contract.state === stateFilter;
      const matchesToken =
        tokenFilter === "all" ||
        token.symbol.toLowerCase() === tokenFilter.toLowerCase();
      return matchesQuery && matchesState && matchesToken;
    });
  }, [query, rows, stateFilter, tokenFilter]);

  const fundedRows = rows.filter((row) => FUNDED_STATES.has(row.contract.state));
  const totalInterest = rows.reduce((sum, row) => sum + row.interestRaw, 0n);
  const aaveContracts = rows.filter((row) => row.aaveEligible).length;
  const disputed = rows.filter((row) => row.contract.state === "Disputed").length;
  const open = rows.filter((row) => OPEN_STATES.has(row.contract.state)).length;
  const defaultToken = aaveToken ?? depositTokens[0];

  return (
    <div className="space-y-5">
      <div
        className="grid border border-rule"
        style={{ gap: 1, background: "var(--color-rule)" }}
      >
        <div className="grid gap-px bg-rule md:grid-cols-4">
          <MetricCard
            icon={<Banknote size={18} />}
            label="Total principal"
            value={formatAggregate(rows)}
            detail={`${contracts.length} contracts indexed across supported rails`}
          />
          <MetricCard
            icon={<TrendingUp size={18} />}
            label="Aave interest"
            value={`+${formatMoney(totalInterest, defaultToken, 4)}`}
            detail={`${aaveContracts} funded USDC contracts`}
            accent
          />
          <MetricCard
            icon={<CircleDollarSign size={18} />}
            label="Currently funded"
            value={formatAggregate(fundedRows)}
            detail="Active, releasing, released, disputed"
          />
          <MetricCard
            icon={<ShieldCheck size={18} />}
            label="Operational state"
            value={`${open} open`}
            detail={disputed ? `${disputed} disputed` : "No active disputes"}
          />
        </div>
      </div>

      <div className="border border-rule bg-card">
        {loadError && (
          <div className="border-b border-rule bg-accent-soft px-4 py-3 text-sm text-ink">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <div className="font-medium">Contract index unavailable</div>
                <div className="mt-1 text-xs leading-5 text-muted">
                  The admin shell loaded, but the database read failed:{" "}
                  {loadError}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3 border-b border-rule px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-2 border border-rule bg-paper px-3 py-2">
            <Search size={16} className="shrink-0 text-muted" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search title, wallet, state, token, escrow"
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={stateFilter}
              onChange={(event) => setStateFilter(event.target.value)}
              className="border border-rule bg-paper px-3 py-2 text-sm"
            >
              <option value="all">All states</option>
              <option value="open">Open</option>
              <option value="AwaitingCounterparty">Awaiting counterparty</option>
              <option value="Active">Active</option>
              <option value="Releasing">Releasing</option>
              <option value="Released">Released</option>
              <option value="Disputed">Disputed</option>
              <option value="closed">Closed or rescued</option>
            </select>
            <select
              value={tokenFilter}
              onChange={(event) => setTokenFilter(event.target.value)}
              className="border border-rule bg-paper px-3 py-2 text-sm"
            >
              <option value="all">All tokens</option>
              {depositTokens.map((token) => (
                <option key={token.id} value={token.symbol}>
                  {token.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-b border-rule-soft px-4 py-3 text-xs text-muted md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            {isError ? (
              <AlertCircle size={14} className="text-accent" />
            ) : isLoading || isFetching ? (
              <Clock3 size={14} />
            ) : (
              <CheckCircle2 size={14} className="text-green" />
            )}
            <span>
              {aUsdcAddress
                ? `Aave readout refreshes every 10s on ${activeChain.name}.`
                : `Aave aUSDC token is not configured for ${activeChain.name}.`}
            </span>
          </div>
          <span>{visibleRows.length} rows shown</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead className="border-b border-rule bg-paper">
              <tr className="font-mono uppercase text-muted">
                <th className="px-4 py-3 text-[10px] font-normal">Contract</th>
                <th className="px-4 py-3 text-[10px] font-normal">Escrow</th>
                <th className="px-4 py-3 text-[10px] font-normal">Parties</th>
                <th className="px-4 py-3 text-[10px] font-normal">Principal</th>
                <th className="px-4 py-3 text-[10px] font-normal">Aave balance</th>
                <th className="px-4 py-3 text-[10px] font-normal">Interest</th>
                <th className="px-4 py-3 text-[10px] font-normal">State</th>
                <th className="px-4 py-3 text-[10px] font-normal">Created</th>
                <th className="px-4 py-3 text-[10px] font-normal" />
              </tr>
            </thead>
            <tbody className="divide-y divide-rule-soft">
              {visibleRows.map((row) => {
                const href = `/c/${row.contract.escrowAddress ?? row.contract.id}`;
                return (
                  <tr key={row.contract.id} className="hover:bg-paper">
                    <td className="px-4 py-4">
                      <div className="max-w-[220px] truncate font-serif text-base">
                        {row.contract.title}
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted">
                        {row.contract.id.slice(0, 8)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      {shortAddress(row.contract.escrowAddress)}
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] leading-5 text-muted">
                      <div>A {shortAddress(row.contract.partyAWallet)}</div>
                      <div>B {shortAddress(row.contract.partyBWallet)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs">
                        {formatMoney(row.principalRaw, row.token)}
                      </div>
                      <div className="mt-1 text-xs text-muted">{row.token.helper}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono text-xs">
                        {row.balanceRaw !== undefined
                          ? formatMoney(row.balanceRaw, row.token, 4)
                          : "-"}
                      </div>
                      <div className="mt-1 text-xs text-muted">{getStatusCopy(row)}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">
                      <span
                        className={
                          row.interestRaw > 0n ? "text-green" : "text-muted"
                        }
                      >
                        {row.aaveEligible
                          ? `+${formatMoney(row.interestRaw, row.token, 4)}`
                          : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <StateBadge state={row.contract.state} />
                    </td>
                    <td className="px-4 py-4 font-mono text-[11px] text-muted">
                      {formatDate(row.contract.createdAt)}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Link
                        href={href}
                        className="inline-flex items-center gap-1 font-mono text-[11px] uppercase text-accent"
                      >
                        View
                        <ArrowRight size={12} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {visibleRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted">
                    No contracts match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-card px-5 py-4">
      <div className="mb-4 flex items-center justify-between">
        <span className={accent ? "text-accent" : "text-muted"}>{icon}</span>
        <span className="font-mono text-[10px] uppercase text-muted">{label}</span>
      </div>
      <div
        className="font-serif"
        style={{
          fontSize: 30,
          lineHeight: 1,
          color: accent ? "var(--color-green)" : "var(--color-ink)",
        }}
      >
        {value}
      </div>
      <div className="mt-2 text-xs text-muted">{detail}</div>
    </div>
  );
}
