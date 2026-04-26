"use client";

import { useAccount, useSignTypedData, useWriteContract } from "wagmi";
import { useSmartWallets } from "@privy-io/react-auth/smart-wallets";
import { encodeFunctionData, type Abi, type Hex } from "viem";

type TypedDataArgs = Parameters<
  ReturnType<typeof useSignTypedData>["signTypedDataAsync"]
>[0];

type WriteCall = {
  address: `0x${string}`;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
};

/// Returns the wallet identity the rest of the app should treat as the user.
/// When a Privy smart wallet (Kernel/ZeroDev) is available we route writes
/// and typed-data signatures through it: gas is sponsored by the dashboard
/// paymaster, and the smart account address becomes msg.sender on-chain.
/// Falls back to the wagmi EOA path for external wallets (MetaMask etc.),
/// which keep paying their own gas.
///
/// Note: `address` is the smart account when sponsorship is active, NOT the
/// signer EOA. Use this everywhere we previously relied on
/// `useAccount().address` for identity (token balances, escrow ownership,
/// EIP-712 signer field). The escrow contracts verify sigs via
/// SignatureChecker.isValidSignatureNow, which accepts EIP-1271 from the
/// smart account, so this works end-to-end.
export function useActiveWallet() {
  const eoa = useAccount();
  const smart = useSafeSmartWallets();
  const { writeContractAsync } = useWriteContract();
  const { signTypedDataAsync } = useSignTypedData();

  const smartClient = smart?.client;
  const address = (smartClient?.account.address ?? eoa.address) as
    | `0x${string}`
    | undefined;

  async function writeContract(call: WriteCall): Promise<Hex> {
    if (smartClient) {
      const data = encodeFunctionData({
        abi: call.abi,
        functionName: call.functionName,
        args: call.args as unknown[] | undefined,
      });
      return smartClient.sendTransaction({
        to: call.address,
        data,
        value: call.value ?? 0n,
      });
    }
    return writeContractAsync(call);
  }

  async function signTypedData(args: TypedDataArgs): Promise<Hex> {
    if (smartClient) {
      // viem's SignTypedDataParameters requires `account`; the smart client
      // ignores any explicit account and signs with its own SmartAccount,
      // but TS still demands the field be present.
      return smartClient.signTypedData({
        ...args,
        account: smartClient.account,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    }
    return signTypedDataAsync(args);
  }

  return {
    address,
    isConnected: address !== undefined,
    isSmartWallet: smartClient !== undefined,
    writeContract,
    signTypedData,
  };
}

/// `useSmartWallets` throws when `SmartWalletsProvider` isn't mounted
/// (NEXT_PUBLIC_PRIVY_APP_ID unset → bare wagmi tree). Mirror useSafePrivy
/// in WalletGate so non-Privy builds still render.
function useSafeSmartWallets() {
  try {
    return useSmartWallets();
  } catch {
    return null;
  }
}
