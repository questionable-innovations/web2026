import { PageShell, StateBadge } from "@/components/AppShell";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const trimmed = `${address.slice(0, 6)}…${address.slice(-4)}`;

  return (
    <PageShell active="contracts">
      <div className="px-9 py-8">
        <div className="mb-5 flex items-baseline justify-between">
          <div>
            <div className="ds-eyebrow">Services agreement · {trimmed}</div>
            <h1
              className="mt-1.5 font-serif font-normal"
              style={{ fontSize: 36, lineHeight: 1.15, letterSpacing: -0.7 }}
            >
              Both wallets must approve.
            </h1>
          </div>
          <StateBadge state="Releasing" />
        </div>

        <div
          className="grid gap-8"
          style={{ gridTemplateColumns: "1.2fr 1fr" }}
        >
          <div>
            <div className="border border-rule bg-card p-7">
              <div className="ds-eyebrow mb-4">Approvals — 1 of 2</div>

              <div className="grid grid-cols-2 gap-3.5">
                <div
                  className="p-4.5"
                  style={{
                    background: "var(--color-green-soft)",
                    border: "1px solid var(--color-green)",
                  }}
                >
                  <div
                    className="mb-2 font-mono uppercase"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1,
                      color: "var(--color-green)",
                    }}
                  >
                    ✓ Party A approved
                  </div>
                  <div
                    className="font-serif"
                    style={{ fontSize: 22, lineHeight: 1.1 }}
                  >
                    Aroha @ QInnovate
                  </div>
                  <div
                    className="mt-1 font-mono text-muted"
                    style={{ fontSize: 11 }}
                  >
                    0xA1c4…f39c · 14:08 NZST
                  </div>
                  <div
                    className="mt-3.5 font-mono text-muted"
                    style={{ fontSize: 10 }}
                  >
                    tx 0x9d4f…2e1b
                  </div>
                </div>
                <div
                  className="bg-paper p-4.5"
                  style={{ border: "1px dashed var(--color-accent)" }}
                >
                  <div
                    className="mb-2 font-mono uppercase text-accent"
                    style={{ fontSize: 10, letterSpacing: 1 }}
                  >
                    … awaiting Party B
                  </div>
                  <div
                    className="font-serif"
                    style={{ fontSize: 22, lineHeight: 1.1 }}
                  >
                    Bob Tomlinson
                  </div>
                  <div
                    className="mt-1 font-mono text-muted"
                    style={{ fontSize: 11 }}
                  >
                    0xB7…2c · last seen 11:42
                  </div>
                  <button
                    type="button"
                    className="mt-3.5 w-full bg-accent px-3 py-2.5 text-center text-white"
                    style={{ fontSize: 12 }}
                  >
                    Resend approval link
                  </button>
                </div>
              </div>

              <div
                className="mt-6 bg-paper px-4 py-3.5 font-mono text-muted"
                style={{
                  fontSize: 11,
                  lineHeight: 1.6,
                  border: "1px solid var(--color-rule)",
                }}
              >
                Nudges sent: <span className="text-ink">+0d</span> · next at{" "}
                <span className="text-accent">+3d</span> · then +7d, +14d.
              </div>
            </div>

            <div className="mt-4 bg-ink p-6 text-paper">
              <div className="flex items-center justify-between">
                <div>
                  <div
                    className="font-mono uppercase"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    On release
                  </div>
                  <div
                    className="mt-1 font-serif"
                    style={{ fontSize: 32, lineHeight: 1 }}
                  >
                    $4,800
                    <span style={{ fontSize: 14, opacity: 0.6 }}> NZD</span>
                  </div>
                  <div
                    className="mt-1 font-mono"
                    style={{
                      fontSize: 11,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    → 0xA1c4…f39c (Party A)
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="font-mono uppercase"
                    style={{
                      fontSize: 10,
                      letterSpacing: 1,
                      color: "rgba(255,255,255,0.6)",
                    }}
                  >
                    Audit certificate
                  </div>
                  <div className="mt-1.5 text-accent" style={{ fontSize: 12 }}>
                    auto-generated on release
                  </div>
                </div>
              </div>
            </div>

            <div
              className="mt-4 font-mono text-muted"
              style={{ fontSize: 11, lineHeight: 1.6 }}
            >
              ↳ Release page is a UI stub — proposeRelease / approveRelease
              wiring is not yet connected to the on-chain methods.
            </div>
          </div>

          <div>
            <div className="ds-eyebrow mb-2">What Bob saw in his inbox</div>
            <div className="border border-rule bg-card p-5">
              <div
                className="border-b border-rule-soft pb-3 font-mono text-muted"
                style={{ fontSize: 11, lineHeight: 1.7 }}
              >
                <div>
                  <span className="text-ink">From</span> &nbsp;DealSeal
                  &lt;notify@dealseal.nz&gt;
                </div>
                <div>
                  <span className="text-ink">To</span> &nbsp;&nbsp;&nbsp;
                  bob@acme.co.nz
                </div>
                <div>
                  <span className="text-ink">Subj</span> &nbsp;Release $4,800
                  to QInnovate?
                </div>
              </div>
              <div className="py-4">
                <div
                  className="font-serif"
                  style={{ fontSize: 22, lineHeight: 1.15 }}
                >
                  Hi Bob,
                </div>
                <div
                  className="mt-2.5 leading-relaxed text-ink/70"
                  style={{ fontSize: 14 }}
                >
                  QInnovate has marked the contract complete and proposed
                  release of the $4,800 you placed in escrow on 25 Apr.
                  <br />
                  <br />
                  If the work is done, approve below — one tap, no wallet
                  hunt.
                </div>
                <div
                  className="mt-4 bg-accent px-4 py-3.5 text-center font-semibold text-white"
                >
                  Approve release →
                </div>
                <div
                  className="mt-2.5 font-mono text-muted"
                  style={{ fontSize: 11 }}
                >
                  or <span className="text-accent">flag a dispute</span> ·
                  funds stay in escrow until you both agree
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
