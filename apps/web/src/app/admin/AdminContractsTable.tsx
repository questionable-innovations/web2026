"use client";

import { useMemo } from "react";
import { formatUnits, Address } from "viem";
import { useReadContracts } from "wagmi";
import Link from "next/link";

// Minimal aToken ABI to just fetch the balance
const aTokenAbi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

// Aave V3 aUSDC on Avalanche
const A_TOKEN_USDC = "0x625E7708f30cA75bfd92586e17077590C60eb4cD" as Address;
// Native USDC on Avalanche C-chain - must match factory's aaveSupportedToken
// for the interest readout to be meaningful.
const USDC_AVALANCHE = "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" as Address;

type ContractData = {
  id: string;
  escrowAddress: string | null;
  title: string;
  depositAmount: string;
  depositToken: string;
  state: string;
};

const isUsdc = (t: string) => t.toLowerCase() === USDC_AVALANCHE.toLowerCase();

export function AdminContractsTable({ contracts }: { contracts: ContractData[] }) {
  // Only query aUSDC for USDC-denominated contracts. Other tokens (dNZD etc.)
  // never get supplied to Aave by the factory, so a balanceOf there would be
  // 0 and rendered as a misleading "no interest" row.
  const wagmiCalls = useMemo(() => {
    return contracts.map((c) =>
      isUsdc(c.depositToken) && c.escrowAddress
        ? {
            address: A_TOKEN_USDC,
            abi: aTokenAbi,
            functionName: "balanceOf",
            args: [c.escrowAddress as Address],
          }
        : null
    );
  }, [contracts]);

  const { data: aTokenBalances } = useReadContracts({
    contracts: wagmiCalls.filter((c): c is NonNullable<typeof c> => c !== null),
    query: { refetchInterval: 10000 },
  });

  // Map back from filtered index → original contract index.
  const usdcIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let usdcIdx = 0;
    wagmiCalls.forEach((call, i) => {
      if (call !== null) {
        map.set(i, usdcIdx);
        usdcIdx++;
      }
    });
    return map;
  }, [wagmiCalls]);

  return (
    <div className="rounded-md border bg-white dark:bg-zinc-950 overflow-hidden">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-100 dark:bg-zinc-900 border-b">
          <tr>
            <th className="px-4 py-3 font-medium">Contract ID</th>
            <th className="px-4 py-3 font-medium">Escrow Address</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Principal (USDC)</th>
            <th className="px-4 py-3 font-medium">Accrued Interest</th>
            <th className="px-4 py-3 font-medium">State</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {contracts.map((c, i) => {
            const rawPrincipal = BigInt(c.depositAmount || "0");
            const usdc = isUsdc(c.depositToken);
            const balanceIdx = usdcIndexMap.get(i);
            const aBalanceRaw =
              balanceIdx !== undefined
                ? (aTokenBalances?.[balanceIdx]?.result as bigint | undefined)
                : undefined;

            // Interest is the aToken balance minus the principal amount.
            // Only meaningful for USDC contracts (the others aren't in Aave).
            let interestRaw = 0n;
            if (aBalanceRaw && aBalanceRaw > rawPrincipal) {
              interestRaw = aBalanceRaw - rawPrincipal;
            }

            const principalFormatted = formatUnits(rawPrincipal, 6);
            const interestFormatted = formatUnits(interestRaw, 6);

            return (
              <tr key={c.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                <td className="px-4 py-3 font-mono text-sm max-w-[120px] truncate">
                  <Link href={`/c/${c.id}`} className="hover:underline text-blue-600 dark:text-blue-400">
                    {c.id.substring(0, 8)}...
                  </Link>
                </td>
                <td className="px-4 py-3">
                    <span className="font-mono text-sm">
                      {c.escrowAddress ? `${c.escrowAddress.slice(0, 6)}...${c.escrowAddress.slice(-4)}` : "Pending"}
                    </span>
                </td>
                <td className="px-4 py-3 truncate max-w-[200px]">{c.title}</td>
                <td className="px-4 py-3">${principalFormatted}</td>
                <td className="px-4 py-3 text-green-600 dark:text-green-400 font-medium">
                  {!usdc
                    ? "-"
                    : interestRaw > 0n
                      ? `+$${Number(interestFormatted).toFixed(4)}`
                      : "$0.0000"}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.state === "Closed" ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"}`}>
                    {c.state}
                  </span>
                </td>
              </tr>
            );
          })}
          {contracts.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center py-8 text-zinc-500">
                No active contracts found.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}