"use client";

import { useAccount, useConnect } from "wagmi";

export function WalletGate({ children }: { children: (address: `0x${string}`) => React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();

  if (!isConnected || !address) {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">
          Connect a wallet to sign — embedded (email) or browser extension.
        </p>
        <div className="flex flex-wrap gap-2">
          {connectors.map((c) => (
            <button
              key={c.uid}
              type="button"
              disabled={isPending}
              onClick={() => connect({ connector: c })}
              className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm hover:bg-[color:var(--color-surface)] disabled:opacity-50"
            >
              {c.name}
            </button>
          ))}
        </div>
        {error && <p className="text-xs text-red-400">{error.message}</p>}
      </div>
    );
  }

  return <>{children(address)}</>;
}
