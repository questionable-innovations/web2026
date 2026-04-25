import { PageShell } from "@/components/AppShell";

export default function SettingsPage() {
  return (
    <PageShell active="settings">
      <div className="px-9 py-8">
        <div className="mb-8">
          <div className="ds-eyebrow">Account · Settings</div>
          <h1
            className="mt-1.5 font-serif font-normal"
            style={{ fontSize: 44, lineHeight: 1.15, letterSpacing: -0.9 }}
          >
            Settings.
          </h1>
        </div>

        <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div className="border border-rule bg-card p-7">
            <div className="ds-eyebrow mb-3">Profile</div>
            <Stub label="Display name" value="—" />
            <Stub label="Verified email" value="—" />
            <Stub
              label="Notifications"
              value="Email — release proposals, dispute flags"
            />
            <Stub
              label="Default network"
              value="Avalanche Fuji · testnet"
            />
          </div>

          <div className="space-y-4">
            <div className="border border-rule bg-card p-6">
              <div className="ds-eyebrow mb-3">Wallet</div>
              <p className="text-sm text-ink/70">
                DealSeal uses your connected wallet for every signature and
                deposit. Disconnect from your wallet provider to switch.
              </p>
            </div>
            <div
              className="bg-paper p-4 font-mono text-muted"
              style={{
                fontSize: 11,
                lineHeight: 1.6,
                border: "1px solid var(--color-rule)",
              }}
            >
              ↳ Settings is a stub. Profile + notification preferences will
              land alongside the audit-certificate work.
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Stub({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between border-b border-rule-soft py-3 last:border-0"
      style={{ fontSize: 13 }}
    >
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
