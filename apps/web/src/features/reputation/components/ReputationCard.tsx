type Stats = {
  completed: number;
  disputed: number;
  disputeRate: string;
  firstSeen: string;
};

export function ReputationCard({ wallet }: { wallet: string }) {
  // TODO: read from ReputationView contract via viem.
  const stats: Stats = {
    completed: 14,
    disputed: 0,
    disputeRate: "0.0%",
    firstSeen: "2025-08-14",
  };

  // 18-month activity histogram, placeholder until ReputationView is wired.
  const activity = [1, 0, 1, 2, 1, 1, 0, 1, 2, 1, 0, 1, 1, 2, 0, 1, 1, 2];
  const short = `${wallet.slice(0, 6)}…${wallet.slice(-4)}`;

  return (
    <div className="px-16 py-7">
      <div className="mb-7 flex items-center justify-between">
        <span
          className="font-serif"
          style={{ fontSize: 22, letterSpacing: -0.4 }}
        >
          DealSeal
        </span>
        <span
          className="font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          Public profile · /b/{short}
        </span>
      </div>

      <div
        className="grid items-start gap-12"
        style={{ gridTemplateColumns: "1.2fr 1fr" }}
      >
        <div>
          <div
            className="font-mono uppercase text-accent"
            style={{ fontSize: 11, letterSpacing: 2 }}
          >
            Tier · trusted
          </div>
          <h1
            className="my-3 font-serif font-normal"
            style={{ fontSize: 72, lineHeight: 1.02, letterSpacing: -2 }}
          >
            {short}
          </h1>
          <div className="text-base text-muted">
            Wellington · Independent · First seen {stats.firstSeen}
          </div>

          <div
            className="mt-8 grid grid-cols-3 border border-rule"
            style={{ gap: 1, background: "var(--color-rule)" }}
          >
            {[
              [String(stats.completed), "Completed", "var(--color-accent)"],
              [String(stats.disputed), "Disputed", "var(--color-ink)"],
              [stats.disputeRate, "Dispute rate", "var(--color-ink)"],
            ].map(([v, l, c]) => (
              <div key={l} className="bg-card px-5 py-6">
                <div
                  className="font-serif"
                  style={{ fontSize: 56, lineHeight: 1, color: c }}
                >
                  {v}
                </div>
                <div
                  className="mt-2 font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 border border-rule bg-card p-6">
            <div
              className="mb-4 font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              Activity · last 18 months
            </div>
            <div
              className="flex items-end gap-1"
              style={{ height: 80 }}
            >
              {activity.map((n, i) => (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: n === 0 ? "rgba(10,10,10,0.06)" : "var(--color-accent)",
                    opacity: n === 0 ? 1 : 0.3 + n * 0.3,
                    height: `${20 + n * 28}%`,
                  }}
                />
              ))}
            </div>
            <div
              className="mt-2 flex justify-between font-mono uppercase text-muted"
              style={{ fontSize: 9, letterSpacing: 1 }}
            >
              <span>OCT &apos;24</span>
              <span>APR &apos;26</span>
            </div>
          </div>
        </div>

        <div>
          <div className="border border-rule bg-card p-6">
            <div
              className="mb-3 font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              What this profile shows · and doesn&apos;t
            </div>
            <div className="grid grid-cols-2">
              <div className="border-r border-rule pr-4">
                <div
                  className="font-mono uppercase text-green"
                  style={{ fontSize: 10, letterSpacing: 1, color: "var(--color-green)" }}
                >
                  Public
                </div>
                <ul
                  className="mt-2 list-disc pl-5 font-serif"
                  style={{ fontSize: 18, lineHeight: 1.4 }}
                >
                  <li>Completed count</li>
                  <li>Dispute count + rate</li>
                  <li>First-seen-on-platform</li>
                  <li>Value tier (banded)</li>
                </ul>
              </div>
              <div className="pl-5">
                <div
                  className="font-mono uppercase text-accent"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  Hidden
                </div>
                <ul
                  className="mt-2 list-disc pl-5 font-serif text-muted"
                  style={{ fontSize: 18, lineHeight: 1.4 }}
                >
                  <li>Counterparties</li>
                  <li>Raw amounts</li>
                  <li>PDF contents</li>
                  <li>Email / name</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-ink p-6 text-paper">
            <div
              className="mb-2.5 font-mono uppercase"
              style={{
                fontSize: 10,
                letterSpacing: 1.5,
                color: "rgba(255,255,255,0.7)",
              }}
            >
              Latest seal
            </div>
            <div className="font-serif" style={{ fontSize: 26, lineHeight: 1.1 }}>
              Services Agreement
            </div>
            <div
              className="mt-1.5 font-mono"
              style={{ fontSize: 11, color: "rgba(255,255,255,0.8)" }}
            >
              completed 2026-04-02 · NZD 25–50k tier
            </div>
            <div
              className="mt-3.5 border-t border-dashed pt-3.5 font-mono"
              style={{
                fontSize: 11,
                color: "rgba(255,255,255,0.9)",
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              Counterparty: <span className="text-accent">hidden by default</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
