"use client";

import { PdfViewer } from "./PdfViewer";
import { SignAndDeposit } from "./SignAndDeposit";

export function CounterpartySigning({ escrowAddress }: { escrowAddress: string }) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4">
        <PdfViewer escrowAddress={escrowAddress} />
      </div>
      <aside className="space-y-4">
        <div className="rounded-lg border border-[color:var(--color-border)] p-4">
          <h2 className="text-sm font-medium uppercase tracking-wide text-zinc-400">
            Sign &amp; deposit
          </h2>
          <p className="mt-2 text-xs text-zinc-500">
            Escrow {escrowAddress.slice(0, 6)}…{escrowAddress.slice(-4)}
          </p>
          <SignAndDeposit escrowAddress={escrowAddress} />
        </div>
      </aside>
    </div>
  );
}
