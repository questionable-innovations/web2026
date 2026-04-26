"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  CornerDownRight,
  Flag,
} from "lucide-react";
import { usePublicClient } from "wagmi";
import { formatUnits } from "viem";
import { useActiveWallet } from "@/lib/active-wallet";
import { StateBadge } from "@/components/AppShell";
import { WalletGate } from "@/features/signing/components/WalletGate";
import { ChainGate } from "@/features/signing/components/ChainGate";
import { PdfViewer } from "@/features/signing/components/PdfViewer";
import { escrowAbi } from "@/lib/contracts/abis";
import { activeChain, getDepositTokenByAddress } from "@/lib/chain";

type ReleaseStatus = {
  escrowAddress: `0x${string}`;
  title: string;
  state:
    | "Draft"
    | "AwaitingCounterparty"
    | "Active"
    | "Releasing"
    | "Released"
    | "Disputed"
    | "Closed"
    | "Rescued";
  amount: string;
  depositToken: `0x${string}`;
  pdfHash: `0x${string}`;
  pdfCid: string;
  signedPdfCid: string | null;
  auditCertCid: string | null;
  partyA: { wallet: `0x${string}`; name: string | null; email: string | null };
  partyB:
    | { wallet: `0x${string}`; name: string | null; email: string | null }
    | null;
  proposedReleaseBy: `0x${string}` | null;
  withdrawable: string;
  disputedBy: `0x${string}` | null;
  disputeReason: string | null;
};

const IPFS_GATEWAY =
  process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://ipfs.io/ipfs/";

type Stage =
  | "idle"
  | "proposing"
  | "approving"
  | "withdrawing"
  | "disputing"
  | "cancelling"
  | "error";

export function ReleaseFlow({ escrowAddress }: { escrowAddress: string }) {
  return (
    <WalletGate
      title="Sign in to manage release"
      blurb="Releases require both wallets to approve. Sign in with the wallet that signed this contract."
    >
      {(wallet) => (
        <ChainGate>
          <Inner escrowAddress={escrowAddress} wallet={wallet} />
        </ChainGate>
      )}
    </WalletGate>
  );
}

function Inner({
  escrowAddress,
  wallet,
}: {
  escrowAddress: string;
  wallet: `0x${string}`;
}) {
  // Pin to the configured chain so receipt polling hits the same RPC the tx
  // was sent to, even if the wallet's network drifts post-submit.
  const publicClient = usePublicClient({ chainId: activeChain.id });
  const { writeContract, address: activeAddress } = useActiveWallet();

  const [status, setStatus] = useState<ReleaseStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [showDispute, setShowDispute] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(
        `/api/contracts/${escrowAddress}/release-status`,
        { cache: "no-store" },
      );
      if (!r.ok) throw new Error(`status ${r.status}`);
      const d = (await r.json()) as ReleaseStatus;
      setStatus(d);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "load failed");
    }
  }, [escrowAddress]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      void refresh();
    }, 6000);
    return () => window.clearInterval(id);
  }, [refresh]);

  // Once the escrow reaches a release-terminal state, ask the server to
  // pin the audit certificate to IPFS. POST is idempotent (returns the
  // cached cid if already pinned), so calling it on every poll is safe.
  // Seed from the polled status so a reload reflects an existing pin
  // without waiting for the POST round-trip.
  const [pinnedCid, setPinnedCid] = useState<string | null>(null);
  useEffect(() => {
    if (status?.auditCertCid) setPinnedCid(status.auditCertCid);
  }, [status?.auditCertCid]);
  useEffect(() => {
    if (!status) return;
    if (status.state !== "Released" && status.state !== "Closed") return;
    if (pinnedCid) return;
    let cancelled = false;
    fetch(`/api/contracts/${escrowAddress}/certificate`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { cid?: string } | null) => {
        if (!cancelled && d?.cid) setPinnedCid(d.cid);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [escrowAddress, status, pinnedCid]);

  const role = useMemo(() => {
    if (!status) return null;
    if (wallet.toLowerCase() === status.partyA.wallet.toLowerCase()) {
      return "A" as const;
    }
    if (
      status.partyB &&
      wallet.toLowerCase() === status.partyB.wallet.toLowerCase()
    ) {
      return "B" as const;
    }
    return "observer" as const;
  }, [status, wallet]);

  async function withTx<T>(
    label: Stage,
    fn: () => Promise<T>,
  ): Promise<T | null> {
    setErrorMsg(null);
    setStage(label);
    try {
      const out = await fn();
      // Mirror new state into the DB cache (so /contracts dashboard updates).
      await fetch(`/api/contracts/${escrowAddress}/sync-state`, {
        method: "POST",
      }).catch(() => {});
      await refresh();
      setStage("idle");
      return out;
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "transaction failed");
      setStage("error");
      return null;
    }
  }

  async function onPropose() {
    if (!publicClient) return;
    await withTx("proposing", async () => {
      const hash = await writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: "proposeRelease",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      // Trigger the email to the counterparty.
      await fetch(`/api/contracts/${escrowAddress}/propose-release`, {
        method: "POST",
      }).catch(() => {});
      return hash;
    });
  }

  async function onApprove() {
    if (!publicClient) return;
    await withTx("approving", async () => {
      const hash = await writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: "approveRelease",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    });
  }

  async function onWithdraw() {
    if (!publicClient) return;
    await withTx("withdrawing", async () => {
      const hash = await writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: "withdraw",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    });
  }

  async function onDispute() {
    if (!publicClient) return;
    const reason = disputeReason.trim() || "no reason given";
    await withTx("disputing", async () => {
      const hash = await writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: "flagDispute",
        args: [reason],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setShowDispute(false);
      setDisputeReason("");
      return hash;
    });
  }

  async function onCancelDispute() {
    if (!publicClient) return;
    await withTx("cancelling", async () => {
      const hash = await writeContract({
        address: escrowAddress as `0x${string}`,
        abi: escrowAbi,
        functionName: "cancelDispute",
      });
      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    });
  }

  if (loadError && !status) {
    return (
      <div className="border border-rule bg-card p-7 text-sm text-accent">
        Couldn&apos;t load release status: {loadError}
      </div>
    );
  }
  if (!status) {
    return (
      <div className="border border-rule bg-card p-7 text-sm text-muted">
        Loading release status…
      </div>
    );
  }

  const tokenConfig = getDepositTokenByAddress(status.depositToken);
  // status.amount is the raw on-chain bigint (base units). Format against the
  // token's own decimals — a USDC escrow's amount is 1e6× the user-facing
  // value, so rendering the raw string would show six extra zeroes.
  const amountDisplay = (() => {
    try {
      return formatUnits(BigInt(status.amount), tokenConfig.decimals);
    } catch {
      return status.amount;
    }
  })();
  const amountNumeric = Number(amountDisplay);
  const amountLabel = Number.isFinite(amountNumeric)
    ? amountNumeric.toLocaleString()
    : amountDisplay;

  const proposer = status.proposedReleaseBy?.toLowerCase() ?? null;
  const proposedByA = Boolean(
    proposer && proposer === status.partyA.wallet.toLowerCase(),
  );
  const proposedByB = Boolean(
    proposer &&
      status.partyB &&
      proposer === status.partyB.wallet.toLowerCase(),
  );

  const settled = status.state === "Released" || status.state === "Closed";
  const approvedA = settled || proposedByA;
  const approvedB = settled || proposedByB;

  const canProposeA = role === "A" && status.state === "Active";
  const canProposeB = role === "B" && status.state === "Active";
  const canApprove =
    status.state === "Releasing" &&
    proposer !== null &&
    role !== "observer" &&
    wallet.toLowerCase() !== proposer;
  const canWithdraw = role === "A" && status.state === "Released";
  const canDispute =
    (status.state === "Active" || status.state === "Releasing") &&
    role !== "observer";
  const canCancelDispute =
    status.state === "Disputed" &&
    status.disputedBy?.toLowerCase() === wallet.toLowerCase();

  const trimmed = `${status.escrowAddress.slice(0, 6)}…${status.escrowAddress.slice(-4)}`;

  return (
    <div className="px-9 py-8">
      <div className="mb-5 flex items-baseline justify-between">
        <div>
          <div className="ds-eyebrow">
            {status.title} · {trimmed}
          </div>
          <h1
            className="mt-1.5 font-serif font-normal"
            style={{ fontSize: 36, lineHeight: 1.15, letterSpacing: -0.7 }}
          >
            {headline(status.state)}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <StateBadge state={status.state} />
          <span
            className="font-mono text-muted"
            style={{ fontSize: 11 }}
          >
            you · {abbreviateRole(role)}
          </span>
        </div>
      </div>

      {status.state === "Active" && (
        <Banner tone="muted">
          The deposit is sitting in escrow. Either party can propose release
          when the work is done; the other side then approves.
        </Banner>
      )}
      {status.state === "Disputed" && (
        <DisputeBanner
          disputedBy={status.disputedBy}
          reason={status.disputeReason}
          escrowAddress={escrowAddress}
          hasAuditCert={Boolean(pinnedCid)}
          hasSignedPdf={Boolean(status.signedPdfCid)}
        />
      )}
      {status.state === "Released" && (
        <Banner tone="ok">
          Both parties approved. {status.partyA.name ?? "Party A"} can now
          withdraw the funds; anyone may trigger the pull.
        </Banner>
      )}
      {status.state === "Closed" && (
        <Banner tone="ok">
          Funds withdrawn. Audit certificate available below.
        </Banner>
      )}

      <div
        className="mt-6 grid gap-8"
        style={{ gridTemplateColumns: "1.2fr 1fr" }}
      >
        <div>
          <div className="border border-rule bg-card p-7">
            <div className="ds-eyebrow mb-4">
              Approvals · {countApprovals(approvedA, approvedB)} of 2
            </div>

            <div className="grid grid-cols-2 gap-3.5">
              <PartyCard
                label="Party A"
                name={status.partyA.name}
                wallet={status.partyA.wallet}
                approved={approvedA}
                youAre={role === "A"}
                pending={status.state === "Releasing" && !proposedByA}
              />
              <PartyCard
                label="Party B"
                name={status.partyB?.name ?? null}
                wallet={status.partyB?.wallet ?? null}
                approved={approvedB}
                youAre={role === "B"}
                pending={status.state === "Releasing" && !proposedByB}
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-2.5">
              {canProposeA || canProposeB ? (
                <ActionButton
                  label="Propose release"
                  primary
                  pending={stage === "proposing"}
                  onClick={onPropose}
                />
              ) : null}
              {canApprove ? (
                <ActionButton
                  label="Approve release"
                  primary
                  pending={stage === "approving"}
                  onClick={onApprove}
                />
              ) : null}
              {canWithdraw ? (
                <ActionButton
                  label={`Withdraw $${amountLabel}`}
                  primary
                  pending={stage === "withdrawing"}
                  onClick={onWithdraw}
                />
              ) : null}
              {canDispute ? (
                <ActionButton
                  label="Flag a dispute"
                  pending={stage === "disputing"}
                  onClick={() => setShowDispute((v) => !v)}
                />
              ) : null}
              {canCancelDispute ? (
                <ActionButton
                  label="Cancel dispute"
                  pending={stage === "cancelling"}
                  onClick={onCancelDispute}
                />
              ) : null}
            </div>

            {showDispute && (
              <div
                className="mt-4 border border-accent bg-paper p-4"
              >
                <div
                  className="mb-1 font-mono uppercase text-accent"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  Flag a dispute · funds freeze
                </div>
                <p
                  className="mb-3 leading-relaxed text-ink/80"
                  style={{ fontSize: 13 }}
                >
                  DealSeal does not arbitrate. Flagging a dispute keeps the
                  funds in escrow and records the disagreement on-chain. You
                  and your counterparty resolve it the same way you&apos;d
                  resolve any commercial dispute (negotiation, mediation,
                  Disputes Tribunal, District Court). The signed PDF and
                  audit certificate below are your evidence.
                </p>
                <div
                  className="mb-1.5 font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  Reason (recorded on-chain · visible in reputation)
                </div>
                <textarea
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={3}
                  className="w-full bg-paper p-2 text-sm"
                  style={{ border: "1px solid var(--color-rule)" }}
                  placeholder="e.g. deliverable §3 not met; see exhibits in lawyer's letter"
                />
                <div className="mt-2 flex gap-2">
                  <ActionButton
                    label="Freeze funds & flag dispute"
                    primary
                    pending={stage === "disputing"}
                    onClick={onDispute}
                  />
                  <ActionButton
                    label="Cancel"
                    onClick={() => {
                      setShowDispute(false);
                      setDisputeReason("");
                    }}
                  />
                </div>
              </div>
            )}

            {errorMsg && (
              <p
                className="mt-3 font-mono text-accent"
                style={{ fontSize: 11 }}
              >
                {errorMsg}
              </p>
            )}

            <div
              className="mt-6 bg-paper px-4 py-3.5 font-mono text-muted"
              style={{
                fontSize: 11,
                lineHeight: 1.6,
                border: "1px solid var(--color-rule)",
              }}
            >
              Polled every 6s · status reflects on-chain state for{" "}
              <span className="text-ink">{trimmed}</span>.
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
                  {status.state === "Closed" ? "Released" : "On release"}
                </div>
                <div
                  className="mt-1 font-serif"
                  style={{ fontSize: 32, lineHeight: 1 }}
                >
                  ${amountLabel}
                  <span style={{ fontSize: 14, opacity: 0.6 }}>
                    {" "}
                    {tokenConfig.symbol}
                  </span>
                </div>
                <div
                  className="mt-1 font-mono"
                  style={{
                    fontSize: 11,
                    color: "rgba(255,255,255,0.7)",
                  }}
                >
                  <ArrowRight size={11} className="inline-block mr-1 align-text-bottom" />
                  {status.partyA.wallet.slice(0, 6)}…
                  {status.partyA.wallet.slice(-4)} (Party A)
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
                {status.state === "Closed" || status.state === "Released" ? (
                  <div className="mt-1.5">
                    <a
                      href={`/api/contracts/${escrowAddress}/certificate`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-accent"
                      style={{ fontSize: 12 }}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        Download PDF
                        <ArrowRight size={12} />
                      </span>
                    </a>
                    {pinnedCid && (
                      <div
                        className="mt-1 font-mono"
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.6)",
                        }}
                      >
                        pinned · {pinnedCid.slice(0, 10)}…
                      </div>
                    )}
                  </div>
                ) : (
                  <div
                    className="mt-1.5 text-accent"
                    style={{ fontSize: 12 }}
                  >
                    auto-generated on release
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            className="mt-4 font-mono text-muted"
            style={{ fontSize: 11, lineHeight: 1.6 }}
          >
            <CornerDownRight size={11} className="inline-block mr-1 align-text-bottom" />
            Connected as {activeAddress?.slice(0, 6)}…
            {activeAddress?.slice(-4)} · role {abbreviateRole(role)}.
          </div>
        </div>

        <div>
          <div className="ds-eyebrow mb-2">Artifacts</div>
          <div className="mb-5 border border-rule bg-card p-5">
            <CidRow
              label="Original PDF"
              cid={status.pdfCid}
              hash={status.pdfHash}
            />
            {status.signedPdfCid && (
              <CidRow
                label="Signed PDF"
                cid={status.signedPdfCid}
                hint="includes both signature blocks"
              />
            )}
            {pinnedCid && (
              <CidRow
                label="Audit certificate"
                cid={pinnedCid}
                hint="pinned on release · CCLA s.229"
              />
            )}
          </div>

          <div className="mb-5 border border-rule bg-card p-4.5">
            <div
              className="mb-3 flex justify-between font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1 }}
            >
              <span>{status.title}</span>
              <span>
                SHA256 · {status.pdfHash.slice(0, 6)}…
                {status.pdfHash.slice(-4)}
              </span>
            </div>
            <PdfViewer escrowAddress={escrowAddress} signed />
          </div>

          <div className="ds-eyebrow mb-2">
            {status.partyB?.email
              ? `What ${status.partyB.name ?? "Party B"} sees`
              : "Counterparty notification"}
          </div>
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
                {status.partyB?.email ?? "-"}
              </div>
              <div>
                <span className="text-ink">Subj</span> &nbsp;Release $
                {amountLabel} for {status.title}?
              </div>
            </div>
            <div className="py-4">
              <div
                className="font-serif"
                style={{ fontSize: 22, lineHeight: 1.15 }}
              >
                Hi {status.partyB?.name ?? "there"},
              </div>
              <div
                className="mt-2.5 leading-relaxed text-ink/70"
                style={{ fontSize: 14 }}
              >
                {status.partyA.name ?? "Party A"} has marked the contract
                complete and proposed release of the ${amountLabel} you
                placed in escrow.
                <br />
                <br />
                If the work is done, approve below: one tap, no wallet
                hunt.
              </div>
              <a
                href={`/c/${escrowAddress}/release`}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 bg-accent px-4 py-3.5 font-semibold text-white"
              >
                Approve release
                <ArrowRight size={14} />
              </a>
              <div
                className="mt-2.5 font-mono text-muted"
                style={{ fontSize: 11 }}
              >
                Email auto-sends when {status.partyA.name ?? "Party A"}{" "}
                clicks &quot;Propose release&quot;.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function headline(state: ReleaseStatus["state"]): string {
  switch (state) {
    case "Draft":
    case "AwaitingCounterparty":
      return "Awaiting countersign · no release yet.";
    case "Active":
      return "Both wallets must approve.";
    case "Releasing":
      return "Awaiting counterparty approval.";
    case "Released":
      return "Approved · ready to withdraw.";
    case "Closed":
      return "Funds released.";
    case "Disputed":
      return "Dispute on record.";
    case "Rescued":
      return "Funds rescued.";
  }
}

function abbreviateRole(role: "A" | "B" | "observer" | null): string {
  if (role === "A") return "Party A";
  if (role === "B") return "Party B";
  if (role === "observer") return "observer";
  return "-";
}

function countApprovals(a: boolean, b: boolean): number {
  return (a ? 1 : 0) + (b ? 1 : 0);
}

function PartyCard({
  label,
  name,
  wallet,
  approved,
  youAre,
  pending,
}: {
  label: string;
  name: string | null;
  wallet: `0x${string}` | null;
  approved: boolean;
  youAre: boolean;
  pending: boolean;
}) {
  if (approved) {
    return (
      <div
        className="p-4.5"
        style={{
          background: "var(--color-green-soft)",
          border: "1px solid var(--color-green)",
        }}
      >
        <div
          className="mb-2 inline-flex items-center gap-1.5 font-mono uppercase"
          style={{
            fontSize: 10,
            letterSpacing: 1,
            color: "var(--color-green)",
          }}
        >
          <Check size={11} strokeWidth={2.5} />
          {label} approved {youAre ? "(you)" : ""}
        </div>
        <div
          className="font-serif"
          style={{ fontSize: 22, lineHeight: 1.1 }}
        >
          {name ?? "-"}
        </div>
        {wallet && (
          <div
            className="mt-1 font-mono text-muted"
            style={{ fontSize: 11 }}
          >
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      className="bg-paper p-4.5"
      style={{ border: "1px dashed var(--color-accent)" }}
    >
      <div
        className="mb-2 font-mono uppercase text-accent"
        style={{ fontSize: 10, letterSpacing: 1 }}
      >
        {pending
          ? `… awaiting ${label}`
          : `${label} (no proposal yet)`}
        {youAre ? " · you" : ""}
      </div>
      <div
        className="font-serif"
        style={{ fontSize: 22, lineHeight: 1.1 }}
      >
        {name ?? "-"}
      </div>
      {wallet && (
        <div
          className="mt-1 font-mono text-muted"
          style={{ fontSize: 11 }}
        >
          {wallet.slice(0, 6)}…{wallet.slice(-4)}
        </div>
      )}
    </div>
  );
}

function DisputeBanner({
  disputedBy,
  reason,
  escrowAddress,
  hasAuditCert,
  hasSignedPdf,
}: {
  disputedBy: `0x${string}` | null;
  reason: string | null;
  escrowAddress: string;
  hasAuditCert: boolean;
  hasSignedPdf: boolean;
}) {
  return (
    <div
      className="border border-accent bg-paper px-5 py-4"
      style={{ borderLeftWidth: 3 }}
    >
      <div
        className="inline-flex items-center gap-2 font-mono uppercase text-accent"
        style={{ fontSize: 11, letterSpacing: 2 }}
      >
        <Flag size={12} strokeWidth={2.2} />
        Dispute on record · funds frozen
      </div>
      <p
        className="mt-2 leading-relaxed text-ink"
        style={{ fontSize: 14 }}
      >
        Flagged by{" "}
        <span className="font-mono">
          {disputedBy?.slice(0, 6)}…{disputedBy?.slice(-4)}
        </span>
        . Neither side can release the deposit until the flagging party
        cancels the dispute, or you both agree.
      </p>
      <p
        className="mt-2 leading-relaxed text-ink/75"
        style={{ fontSize: 13 }}
      >
        <strong>DealSeal does not adjudicate.</strong> Disputes are resolved
        through the same channels as any commercial disagreement: direct
        negotiation, mediation, the Disputes Tribunal (claims under
        $30,000), or the District Court. We hold the funds and produce the
        evidence; the legal system decides who&apos;s right.
      </p>

      {reason && (
        <div
          className="mt-3 border border-rule bg-card px-3.5 py-2.5 font-mono"
          style={{ fontSize: 11, lineHeight: 1.6 }}
        >
          <span className="text-muted">on-chain reason:</span> {reason}
        </div>
      )}

      <div className="mt-4">
        <div
          className="ds-eyebrow mb-2"
          style={{ color: "var(--color-accent)" }}
        >
          Evidence pack
        </div>
        <div className="flex flex-wrap gap-2.5">
          {hasSignedPdf && (
            <a
              href={`/api/contracts/${escrowAddress}/pdf?signed=1`}
              target="_blank"
              rel="noreferrer"
              className="border border-ink px-3 py-2 text-ink"
              style={{ fontSize: 12 }}
            >
              <span className="inline-flex items-center gap-1.5">
                <ArrowDown size={12} />
                Signed PDF
              </span>
            </a>
          )}
          <a
            href={`/api/contracts/${escrowAddress}/certificate`}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-3 py-2 text-ink"
            style={{ fontSize: 12 }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ArrowDown size={12} />
              Audit certificate {hasAuditCert ? "(IPFS-pinned)" : ""}
            </span>
          </a>
          <a
            href={`https://testnet.snowtrace.io/address/${escrowAddress}`}
            target="_blank"
            rel="noreferrer"
            className="border border-ink px-3 py-2 text-ink"
            style={{ fontSize: 12 }}
          >
            <span className="inline-flex items-center gap-1.5">
              <ArrowUpRight size={12} />
              On-chain history
            </span>
          </a>
        </div>
        <p
          className="mt-2.5 font-mono text-muted"
          style={{ fontSize: 11, lineHeight: 1.6 }}
        >
          Hand these to your lawyer. The signed PDF carries both
          signatures; the certificate links each signer&apos;s identity to
          their wallet, EIP-712 signature, and the on-chain tx history.
        </p>
      </div>
    </div>
  );
}

function CidRow({
  label,
  cid,
  hash,
  hint,
}: {
  label: string;
  cid: string;
  hash?: string;
  hint?: string;
}) {
  const trimmed = `${cid.slice(0, 10)}…${cid.slice(-6)}`;
  return (
    <div
      className="py-3"
      style={{ borderBottom: "1px dashed var(--color-rule)" }}
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          {label}
        </span>
        <a
          href={`${IPFS_GATEWAY}${cid}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono uppercase text-accent"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          <span className="inline-flex items-center gap-1">
            Open
            <ArrowUpRight size={11} />
          </span>
        </a>
      </div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(cid).catch(() => {});
        }}
        className="mt-1 block w-full text-left font-mono text-ink"
        style={{ fontSize: 12, lineHeight: 1.4 }}
        title={`Copy ${cid}`}
      >
        ipfs://{trimmed}
      </button>
      {hash && (
        <div
          className="mt-1 font-mono text-muted"
          style={{ fontSize: 10 }}
          title={hash}
        >
          sha256 {hash.slice(0, 10)}…{hash.slice(-6)}
        </div>
      )}
      {hint && (
        <div
          className="mt-0.5 font-mono text-muted"
          style={{ fontSize: 10 }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  primary,
  pending,
}: {
  label: string;
  onClick: () => void;
  primary?: boolean;
  pending?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={
        primary
          ? "bg-accent px-4 py-2.5 text-white disabled:opacity-50"
          : "border border-ink px-4 py-2.5 text-ink disabled:opacity-50"
      }
      style={{ fontSize: 13 }}
    >
      {pending ? "…" : label}
    </button>
  );
}

function Banner({
  tone,
  children,
}: {
  tone: "muted" | "alert" | "ok";
  children: React.ReactNode;
}) {
  const palette =
    tone === "alert"
      ? {
          bg: "rgba(182, 89, 50, 0.08)",
          border: "var(--color-accent)",
          fg: "var(--color-ink)",
        }
      : tone === "ok"
        ? {
            bg: "var(--color-green-soft)",
            border: "var(--color-green)",
            fg: "var(--color-ink)",
          }
        : {
            bg: "var(--color-paper-2, var(--color-paper))",
            border: "var(--color-rule)",
            fg: "var(--color-muted)",
          };
  return (
    <div
      className="px-4 py-3"
      style={{
        background: palette.bg,
        borderLeft: `3px solid ${palette.border}`,
        color: palette.fg,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
}
