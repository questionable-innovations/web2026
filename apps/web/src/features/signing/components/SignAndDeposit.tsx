"use client";

import { useEffect, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import { readSecretFromHash } from "@/lib/share-link";

const privyEnabled = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function SignAndDeposit({ escrowAddress: _ }: { escrowAddress: string }) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);

  useEffect(() => {
    setSecret(readSecretFromHash());
  }, []);

  if (!secret) {
    return (
      <p className="mt-4 text-sm text-amber-300">
        This link is missing its access secret. Ask Party A to resend the share
        link in full — the part after <code>#</code> is required.
      </p>
    );
  }

  if (privyEnabled) return <PrivySignAndDeposit />;
  return <WagmiSignAndDeposit />;
}

function WagmiSignAndDeposit() {
  const { isConnected, address } = useAccount();
  const { connect, connectors } = useConnect();

  if (!isConnected) {
    return (
      <button
        onClick={() => connect({ connector: connectors[0] })}
        className="mt-4 w-full rounded-md bg-[color:var(--color-accent)] px-4 py-2 font-medium text-black"
      >
        Connect wallet
      </button>
    );
  }
  return (
    <div className="mt-4 space-y-3 text-sm">
      <p className="text-xs text-zinc-500">Connected as {address?.slice(0, 10)}…</p>
      <button
        disabled
        className="w-full rounded-md border border-[color:var(--color-border)] px-4 py-2 text-zinc-500"
      >
        Sign &amp; deposit (TODO: countersign + safeTransferFrom multicall)
      </button>
    </div>
  );
}

function PrivySignAndDeposit() {
  return (
    <p className="mt-4 text-sm text-zinc-500">
      Privy sign-in goes here once <code>NEXT_PUBLIC_PRIVY_APP_ID</code> is set.
    </p>
  );
}
