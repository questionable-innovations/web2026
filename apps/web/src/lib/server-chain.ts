import { createPublicClient, http } from "viem";
import { avalanche, avalancheFuji } from "viem/chains";
import { escrowAbi, escrowFactoryAbi } from "@/lib/contracts/abis";
import { escrowFactoryAddress } from "@/lib/chain";

const id = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 43113);
const chain = id === 43114 ? avalanche : avalancheFuji;
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;

/// Server-side viem client. Used by API routes to verify that on-chain state
/// matches what a client claims before persisting to the off-chain index —
/// without this, anyone with an escrow address could POST forged metadata.
export const serverPublicClient = createPublicClient({
  chain,
  transport: http(rpcUrl),
});

const STATE_NAMES = [
  "Draft",
  "AwaitingCounterparty",
  "Active",
  "Releasing",
  "Released",
  "Disputed",
  "Closed",
  "Rescued",
] as const;
type EscrowStateName = (typeof STATE_NAMES)[number];

export type OnchainEscrow = {
  state: EscrowStateName;
  partyA: `0x${string}`;
  partyB: `0x${string}`;
  pdfHash: `0x${string}`;
  amount: bigint;
  factory: `0x${string}`;
  proposedReleaseBy: `0x${string}`;
  withdrawable: bigint;
  disputedBy: `0x${string}`;
  disputeReason: string;
};

const ZERO = "0x0000000000000000000000000000000000000000" as `0x${string}`;

/// Read everything we need to validate an off-chain write. Returns null when
/// the address has no contract code (the clone hasn't been deployed) so
/// callers can distinguish "doesn't exist" from "exists but wrong state".
export async function readEscrow(
  address: `0x${string}`,
): Promise<OnchainEscrow | null> {
  const code = await serverPublicClient.getCode({ address });
  if (!code || code === "0x") return null;

  const [
    stateNum,
    partyA,
    partyB,
    pdfHash,
    amount,
    factory,
    proposedReleaseBy,
    withdrawable,
    disputedBy,
    disputeReason,
  ] = await Promise.all([
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "state",
    }) as Promise<number>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "partyA",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "partyB",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "pdfHash",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "amount",
    }) as Promise<bigint>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "factory",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "proposedReleaseBy",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "withdrawable",
    }) as Promise<bigint>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "disputedBy",
    }) as Promise<`0x${string}`>,
    serverPublicClient.readContract({
      address,
      abi: escrowAbi,
      functionName: "disputeReason",
    }) as Promise<string>,
  ]);

  // Be strict: an out-of-range state means the contract has been upgraded
  // and this server is stale — fail loudly rather than silently mislabeling
  // the deal as "Draft".
  const stateName = STATE_NAMES[stateNum];
  if (!stateName) {
    throw new Error(`unknown escrow state ${stateNum}`);
  }

  // Reject clones that didn't come from our configured factory — without
  // this, a bystander could deploy their own escrow with the same ABI
  // shape and pass every other on-chain check.
  if (
    escrowFactoryAddress !== ZERO &&
    factory.toLowerCase() !== escrowFactoryAddress.toLowerCase()
  ) {
    return null;
  }

  return {
    state: stateName,
    partyA,
    partyB,
    pdfHash,
    amount,
    factory,
    proposedReleaseBy,
    withdrawable,
    disputedBy,
    disputeReason,
  };
}

export function isFactoryConfigured(): boolean {
  return escrowFactoryAddress !== ZERO;
}

export { escrowFactoryAddress, escrowFactoryAbi };
