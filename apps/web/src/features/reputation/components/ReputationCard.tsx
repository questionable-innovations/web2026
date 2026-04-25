export function ReputationCard({ wallet }: { wallet: string }) {
  // TODO: read from ReputationView contract via viem.
  const stats = { completed: 0, disputed: 0, totalValue: "0", firstSeenAt: null };
  return (
    <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
      <div className="text-xs uppercase tracking-wide text-zinc-500">Wallet</div>
      <div className="font-mono text-sm">{wallet}</div>
      <dl className="mt-6 grid grid-cols-3 gap-4 text-sm">
        <Stat label="Completed" value={stats.completed} />
        <Stat label="Disputed" value={stats.disputed} />
        <Stat label="Total value" value={`${stats.totalValue} dNZD`} />
      </dl>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div className="text-xs uppercase text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}
