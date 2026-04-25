import { avalanche, avalancheFuji } from "viem/chains";

const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);

export const activeChain = id === 43114 ? avalanche : avalancheFuji;

export const depositToken = {
  address: (process.env.NEXT_PUBLIC_DEPOSIT_TOKEN ??
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
  symbol: process.env.NEXT_PUBLIC_DEPOSIT_TOKEN_SYMBOL ?? "dNZD",
  decimals: Number(process.env.NEXT_PUBLIC_DEPOSIT_TOKEN_DECIMALS ?? 18),
};

export const contractRegistryAddress = (process.env
  .NEXT_PUBLIC_CONTRACT_REGISTRY ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
