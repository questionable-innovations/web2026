import { avalanche, avalancheFuji } from "viem/chains";

const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);

export const activeChain = id === 43114 ? avalanche : avalancheFuji;

const ZERO = "0x0000000000000000000000000000000000000000" as const;
const FUJI_WAVAX = "0xd00ae08403b9bbb9124bb305c09058e32c39a48c";
const FUJI_USDC = "0x5425890298aed601595a70ab815c96711a31bc65";
const MAINNET_WAVAX = "0xb31f66aa3c1e785363f0875a1b74e27b85fd66c7";
const MAINNET_USDC = "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e";

const legacyTokenAddress = process.env.NEXT_PUBLIC_DEPOSIT_TOKEN as
  | `0x${string}`
  | undefined;
const legacyTokenSymbol = process.env.NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL;
const legacyTokenDecimals = Number(
  process.env.NEXT_PUBLIC_DEPOSIT_TOKEN_DECIMALS ?? 18,
);

function configuredAddress(
  value: string | undefined,
  fallback: string,
): `0x${string}` {
  return (value ?? fallback).toLowerCase() as `0x${string}`;
}

export type DepositTokenConfig = {
  id: string;
  label: string;
  symbol: string;
  address: `0x${string}`;
  decimals: number;
  helper: string;
};

export const depositTokens: DepositTokenConfig[] = [
  {
    id: "dnzd",
    label: "DNZD",
    symbol: "DNZD",
    address: configuredAddress(
      process.env.NEXT_PUBLIC_DNZD_TOKEN ??
        process.env.NEXT_PUBLIC_AVAX_TOKEN ??
        (legacyTokenSymbol?.toUpperCase() === "DNZD"
          ? legacyTokenAddress
          : undefined),
      activeChain.id === 43114 ? MAINNET_WAVAX : FUJI_WAVAX,
    ),
    decimals: Number(process.env.NEXT_PUBLIC_DNZD_TOKEN_DECIMALS ?? 18),
    helper: "Demo dNZD rail",
  },
  {
    id: "usdc",
    label: "USDC",
    symbol: "USDC",
    address: configuredAddress(
      process.env.NEXT_PUBLIC_USDC_TOKEN ??
        (legacyTokenSymbol?.toUpperCase() === "USDC"
          ? legacyTokenAddress
          : undefined),
      activeChain.id === 43114 ? MAINNET_USDC : FUJI_USDC,
    ),
    decimals: Number(
      process.env.NEXT_PUBLIC_USDC_TOKEN_DECIMALS ??
        (legacyTokenSymbol?.toUpperCase() === "USDC"
          ? legacyTokenDecimals
          : 6),
    ),
    helper: "Fuji USDC",
  },
];

export const depositToken = depositTokens[0];

export function getDepositTokenByAddress(
  address: string | null | undefined,
): DepositTokenConfig {
  const normalized = address?.toLowerCase();
  return (
    depositTokens.find((token) => token.address.toLowerCase() === normalized) ??
    {
      id: "custom",
      label: legacyTokenSymbol ?? "Token",
      symbol: legacyTokenSymbol ?? "Token",
      address: (address ?? ZERO) as `0x${string}`,
      decimals: legacyTokenDecimals,
      helper: "Custom deposit token",
    }
  );
};

/// EscrowFactory deployment. Read by every signing flow; without it, on-chain
/// calls will revert. Set after `forge script script/Deploy.s.sol`.
export const escrowFactoryAddress = (process.env.NEXT_PUBLIC_ESCROW_FACTORY ??
  process.env.NEXT_PUBLIC_CONTRACT_REGISTRY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const contractRegistryAddress = escrowFactoryAddress;
