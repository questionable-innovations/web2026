"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowRight, ArrowUpRight, Check } from "lucide-react";
import { useAccount, useDisconnect } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { readSecretFromHash } from "@/lib/share-link";
import { BrandMark, Seal } from "@/components/AppShell";
import { PdfViewer } from "./PdfViewer";
import { SignAndPayForm } from "./SignAndDeposit";
import { WalletGate } from "./WalletGate";
import { ProfileGate } from "./ProfileGate";
import { ChainGate } from "./ChainGate";
import { getDepositTokenByAddress } from "@/lib/chain";

const POST_SECRET_STATES = new Set([
  "Active",
  "Released",
  "Disputed",
  "Closed",
  "Rescued",
]);

type ContractInfo = {
  escrowAddress: `0x${string}`;
  title: string;
  pdfHash: `0x${string}`;
  signedPdfCid: string | null;
  hasSignedPdf: boolean;
  partyAName: string | null;
  partyAWallet: `0x${string}`;
  partyBWallet: `0x${string}` | null;
  counterpartyEmailMasked: string | null;
  counterpartyEmail: string | null;
  counterpartyName: string | null;
  depositAmount: string;
  totalDue: string | null;
  depositToken: `0x${string}`;
  dealDeadline: number | null;
  state: string;
};

type View = "landing" | "sign" | "done";

export function CounterpartySigning({ escrowAddress }: { escrowAddress: string }) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [info, setInfo] = useState<ContractInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<View>("landing");
  const { address: connectedWallet } = useAccount();

  useEffect(() => {
    setSecret(readSecretFromHash());
  }, []);

  const loadInfo = useCallback(
    async (signal?: AbortSignal): Promise<ContractInfo | null> => {
      try {
        const r = await fetch(`/api/contracts/${escrowAddress}`, { signal });
        if (!r.ok) throw new Error("not found");
        const d = (await r.json()) as ContractInfo;
        if (signal?.aborted) return null;
        setInfo(d);
        return d;
      } catch (err) {
        if (signal?.aborted) return null;
        setLoadError(err instanceof Error ? err.message : "load failed");
        return null;
      }
    },
    [escrowAddress],
  );

  useEffect(() => {
    const controller = new AbortController();
    loadInfo(controller.signal).then((d) => {
      if (controller.signal.aborted || !d) return;
      if (POST_SECRET_STATES.has(d.state)) {
        setView("done");
      }
    });
    return () => controller.abort();
  }, [loadInfo]);

  if (loadError) {
    return (
      <Frame>
        <p className="text-sm text-accent">Couldn&apos;t load this contract.</p>
      </Frame>
    );
  }
  if (!info) {
    return (
      <Frame>
        <p className="text-sm text-muted">Loading contract…</p>
      </Frame>
    );
  }

  const isPartyA =
    connectedWallet?.toLowerCase() === info.partyAWallet.toLowerCase();
  const canCountersign = !isPartyA && !!secret;

  if (view === "landing") {
    return (
      <BLanding
        info={info}
        isPartyA={isPartyA}
        canCountersign={canCountersign}
        onContinue={() => setView("sign")}
      />
    );
  }
  if (view === "sign" && secret && !isPartyA) {
    return (
      <BSignPay
        info={info}
        secret={secret}
        onDone={() => {
          setView("done");
          // Pull fresh state so BReceipt sees partyBWallet, signedPdfCid,
          // and the post-countersign contract state.
          void loadInfo();
        }}
      />
    );
  }
  return <BReceipt info={info} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper px-16 py-7">
      <div className="mb-7 flex items-center justify-between">
        <BrandMark />
      </div>
      {children}
    </div>
  );
}

function BLanding({
  info,
  isPartyA,
  canCountersign,
  onContinue,
}: {
  info: ContractInfo;
  isPartyA: boolean;
  canCountersign: boolean;
  onContinue: () => void;
}) {
  const selectedToken = getDepositTokenByAddress(info.depositToken);

  return (
    <div className="min-h-screen bg-paper px-16 py-7">
      <div className="mb-5 flex items-center justify-between">
        <BrandMark />
        <span
          className="font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          Addressed to {info.counterpartyEmailMasked ?? "-"}
        </span>
      </div>

      <div
        className="grid items-start gap-8"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <div>
          <div
            className="font-mono uppercase text-accent"
            style={{ fontSize: 10, letterSpacing: 2 }}
          >
            You&apos;ve been sent a contract
          </div>
          <h1
            className="my-3 font-serif font-normal"
            style={{ fontSize: 56, lineHeight: 1.1, letterSpacing: -1.2 }}
          >
            <em className="text-accent not-italic">
              {info.partyAName ?? "Party A"}
            </em>{" "}
            wants to seal a deal with you.
          </h1>
          <p
            className="max-w-md leading-relaxed text-ink/80"
            style={{ fontSize: 15 }}
          >
            Read the document first. When you&apos;re ready, you&apos;ll sign
            and place the deposit in one transaction.{" "}
            <strong>You can verify everything before any wallet prompt.</strong>
          </p>

          <div className="mt-6 border border-rule bg-card p-5">
            <div
              className="mb-3 flex justify-between font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1 }}
            >
              <span>From</span>
              <span>Verified · NZBN</span>
            </div>
            <div className="font-serif" style={{ fontSize: 24, lineHeight: 1.1 }}>
              {info.partyAName ?? "Party A"}
            </div>
            <a
              href={`/b/${info.partyAWallet}`}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-block font-mono text-muted hover:text-ink"
              style={{ fontSize: 11 }}
            >
              {info.partyAWallet.slice(0, 6)}…{info.partyAWallet.slice(-4)} ·
              on-chain reputation
            </a>

            <div
              className="mt-4 mb-4 border-t border-dashed"
              style={{ borderColor: "var(--color-rule)" }}
            />

            <div className="grid grid-cols-2 gap-3">
              {info.totalDue && (
                <div>
                  <div
                    className="font-mono uppercase text-muted"
                    style={{ fontSize: 10, letterSpacing: 1 }}
                  >
                    Total due
                  </div>
                  <div
                    className="mt-1 font-serif"
                    style={{ fontSize: 36, lineHeight: 1 }}
                  >
                    ${Number(info.totalDue).toLocaleString()}
                    <span className="text-muted" style={{ fontSize: 14 }}>
                      {" "}
                      {selectedToken.symbol}
                    </span>
                  </div>
                </div>
              )}
              <div>
                <div
                  className="font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  Deposit
                </div>
                <div
                  className="mt-1 font-serif"
                  style={{ fontSize: 36, lineHeight: 1 }}
                >
                  ${Number(info.depositAmount).toLocaleString()}
                  <span className="text-muted" style={{ fontSize: 14 }}>
                    {" "}
                    {selectedToken.symbol}
                  </span>
                </div>
              </div>
              <div>
                <div
                  className="font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  Expires
                </div>
                <div className="mt-1 font-serif" style={{ fontSize: 22 }}>
                  {formatExpiry(info.dealDeadline)}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center gap-3">
            {isPartyA ? (
              <>
                <span
                  className="bg-ink px-6 py-3.5 text-paper"
                  style={{ fontSize: 14 }}
                >
                  <span className="inline-flex items-center gap-2">
                    Waiting for {info.counterpartyName ?? "counterparty"} to
                    sign
                  </span>
                </span>
                <span
                  className="font-mono text-muted"
                  style={{ fontSize: 11 }}
                >
                  (this is your deal)
                </span>
              </>
            ) : canCountersign ? (
              <>
                <button
                  type="button"
                  onClick={onContinue}
                  className="bg-ink px-6 py-3.5 text-paper"
                  style={{ fontSize: 14 }}
                >
                  <span className="inline-flex items-center gap-2">
                    Review the document
                    <ArrowRight size={14} />
                  </span>
                </button>
                <span
                  className="font-mono text-muted"
                  style={{ fontSize: 11 }}
                >
                  (no wallet prompt yet)
                </span>
              </>
            ) : (
              <>
                <span
                  className="bg-ink/30 px-6 py-3.5 text-paper"
                  style={{ fontSize: 14 }}
                >
                  Sign &amp; pay (link incomplete)
                </span>
                <span
                  className="font-mono text-accent"
                  style={{ fontSize: 11 }}
                >
                  share link is missing the part after <code>#</code>
                </span>
              </>
            )}
          </div>
        </div>

        <div className="border border-rule bg-card p-4.5">
          <div
            className="mb-3 flex justify-between font-mono uppercase text-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            <span>
              {info.title} · {info.hasSignedPdf ? "signed copy" : "preview"}
            </span>
            <span>SHA256 · {info.pdfHash.slice(0, 6)}…{info.pdfHash.slice(-4)}</span>
          </div>
          <PdfViewer
            escrowAddress={info.escrowAddress}
            signed={info.hasSignedPdf}
          />
        </div>
      </div>
    </div>
  );
}

function BSignPay({
  info,
  secret,
  onDone,
}: {
  info: ContractInfo;
  secret: `0x${string}`;
  onDone: () => void;
}) {
  // The wallet sign-in / profile / chain gates render light-mode UIs (bg-card
  // on bg-paper). Only flip to the dark sign+deposit canvas once all three
  // gates have passed - otherwise the gate cards sit on a black page and look
  // broken.
  return (
    <Frame>
      <WalletGate
        title="Sign in to seal this deal"
        blurb="Connect a wallet to sign the contract and place the deposit. Your wallet pays the deposit; your signature binds you to the agreement."
      >
        {(address) =>
          address.toLowerCase() === info.partyAWallet.toLowerCase() ? (
            <SameWalletGate info={info} />
          ) : (
            <ProfileGate
              wallet={address}
              prefill={{
                name: info.counterpartyName,
                email: info.counterpartyEmail,
              }}
            >
              {(profile) => (
                <ChainGate>
                  <BSignPayDark info={info}>
                    <SignAndPayForm
                      info={info}
                      secret={secret}
                      wallet={address}
                      profile={profile}
                      onDone={onDone}
                    />
                  </BSignPayDark>
                </ChainGate>
              )}
            </ProfileGate>
          )
        }
      </WalletGate>
    </Frame>
  );
}

/// Dark-canvas layout for the actual sign+deposit step. Rendered as a fixed
/// overlay so it covers the light Frame the gates were sitting in - the
/// gates' render-prop nesting otherwise leaves us nested inside that light
/// container.
function BSignPayDark({
  info,
  children,
}: {
  info: ContractInfo;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto bg-ink text-paper">
      <div className="flex items-center justify-between border-b border-ink-rule-soft px-8 py-5">
        <span
          className="font-serif text-paper"
          style={{ fontSize: 22, letterSpacing: -0.4 }}
        >
          DealSeal
        </span>
        <div
          className="flex gap-6 font-mono text-ink-muted"
          style={{ fontSize: 11 }}
        >
          <span className="inline-flex items-center gap-1.5 text-ink-faint">
            <span>1</span>
            REVIEW
            <Check size={12} strokeWidth={2.5} />
          </span>
          <span className="text-paper">
            <span className="mr-1.5">2</span>
            SIGN &amp; PAY
          </span>
          <span className="text-ink-faint">
            <span className="mr-1.5">3</span>
            DONE
          </span>
        </div>
        <span className="font-mono text-ink-muted" style={{ fontSize: 11 }}>
          escrow {info.escrowAddress.slice(0, 6)}…{info.escrowAddress.slice(-4)}
        </span>
      </div>

      <div className="px-16 py-10">
        <div
          className="grid gap-12"
          style={{ gridTemplateColumns: "1fr 1fr" }}
        >
          <div>
            <div
              className="font-mono uppercase text-accent"
              style={{ fontSize: 11, letterSpacing: 2 }}
            >
              One transaction
            </div>
            <h1
              className="mb-4 mt-3 font-serif font-normal"
              style={{ fontSize: 56, lineHeight: 0.96, letterSpacing: -1.6 }}
            >
              Sign the contract
              <br />
              <em className="text-accent not-italic">and</em> place the deposit.
            </h1>
            <p
              className="max-w-md leading-relaxed text-ink-soft"
              style={{ fontSize: 15 }}
            >
              Both halves commit atomically. If the deposit fails, the
              signature reverts. There is no in-between state.
            </p>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

function BReceipt({ info }: { info: ContractInfo }) {
  const selectedToken = getDepositTokenByAddress(info.depositToken);
  const selfSigned =
    info.partyBWallet?.toLowerCase() === info.partyAWallet.toLowerCase();

  return (
    <div className="min-h-screen bg-paper px-16 py-8">
      <div className="mb-6 flex items-center justify-between">
        <BrandMark />
        <div className="flex gap-6 font-mono" style={{ fontSize: 11 }}>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span>1</span>
            REVIEW
            <Check size={12} strokeWidth={2.5} />
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted">
            <span>2</span>
            SIGN &amp; PAY
            <Check size={12} strokeWidth={2.5} />
          </span>
          <span className="text-accent">
            <span className="mr-1.5">3</span>
            DONE
          </span>
        </div>
      </div>

      {selfSigned && <SelfSignedBanner info={info} />}

      <div
        className="grid items-center gap-12"
        style={{ gridTemplateColumns: "1fr 1fr" }}
      >
        <div>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 11,
              letterSpacing: 2,
              color: "var(--color-green)",
            }}
          >
            <Check size={12} strokeWidth={2.5} className="mr-1.5 inline-block" />
            Sealed &amp; deposited
          </div>
          <h1
            className="mt-3 mb-4 font-serif font-normal"
            style={{ fontSize: 56, lineHeight: 1.1, letterSpacing: -1.6 }}
          >
            ${Number(info.depositAmount).toLocaleString()}{" "}
            <em className="text-accent">held in escrow</em>.
          </h1>
          <p
            className="max-w-md leading-relaxed"
            style={{ fontSize: 16, color: "rgba(10,10,10,0.7)" }}
          >
            Not paid to {info.partyAName ?? "Party A"} yet. Funds release only
            when you release it to {info.partyAName ?? "Party A"}, or when
            they refund you. You can verify the deposit on-chain right now.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/contracts"
              className="bg-ink px-5 py-3.5 text-paper"
              style={{ fontSize: 14 }}
            >
              <span className="inline-flex items-center gap-2">
                Open my contracts
                <ArrowRight size={14} />
              </span>
            </a>
            <a
              href={`/c/${info.escrowAddress}/release`}
              className="border border-ink px-5 py-3.5"
              style={{ fontSize: 14 }}
            >
              <span className="inline-flex items-center gap-2">
                Manage release
                <ArrowRight size={14} />
              </span>
            </a>
            <a
              href={`https://testnet.snowtrace.io/address/${info.escrowAddress}`}
              target="_blank"
              rel="noreferrer"
              className="border border-ink px-5 py-3.5"
              style={{ fontSize: 14 }}
            >
              <span className="inline-flex items-center gap-2">
                Verify on Snowtrace
                <ArrowUpRight size={14} />
              </span>
            </a>
          </div>
        </div>

        <div className="relative border border-rule bg-card p-6">
          <div className="absolute" style={{ top: -28, right: 24 }}>
            <Seal size={64} />
          </div>
          <div className="ds-eyebrow mb-2.5">Receipt · Atomic</div>
          <div className="font-mono" style={{ fontSize: 11, lineHeight: 2 }}>
            <ReceiptRow k="signed by" v={info.counterpartyName ?? "-"} />
            <ReceiptRow
              k="contract"
              v={`${info.escrowAddress.slice(0, 6)}…${info.escrowAddress.slice(-4)}`}
            />
            <ReceiptRow
              k="pdfHash"
              v={`${info.pdfHash.slice(0, 6)}…${info.pdfHash.slice(-4)}`}
            />
            <ReceiptRow
              k="amount"
              v={`${info.depositAmount} ${selectedToken.symbol}`}
              accent
            />
            {info.totalDue && (
              <ReceiptRow
                k="totalDue"
                v={`${info.totalDue} ${selectedToken.symbol}`}
              />
            )}
            <ReceiptRow k="release" v="you decide when to release" />
          </div>
          <a
            href={`/api/contracts/${info.escrowAddress}/pdf?signed=1`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-between border border-rule px-4 py-3"
            style={{ fontSize: 13 }}
          >
            <span>Download signed PDF</span>
            <span className="text-accent">
              <ArrowDown size={14} />
            </span>
          </a>
        </div>
      </div>

      <div className="mt-10 border border-rule bg-card p-4.5">
        <div
          className="mb-3 flex justify-between font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          <span>{info.title} · sealed copy</span>
          <span>SHA256 · {info.pdfHash.slice(0, 6)}…{info.pdfHash.slice(-4)}</span>
        </div>
        <PdfViewer escrowAddress={info.escrowAddress} signed />
      </div>
    </div>
  );
}

/// Shown when the wallet that connected inside BSignPay's WalletGate is the
/// same address that created the deal. Without this guard the user can
/// successfully countersign their own escrow (the on-chain contract doesn't
/// reject same-wallet); the resulting "Active" state then short-circuits any
/// future visit to BReceipt with no indication of what happened.
function SameWalletGate({ info }: { info: ContractInfo }) {
  const { disconnect, isPending } = useDisconnect();
  const privy = useSafePrivy();
  const partyA = info.partyAName ?? "Party A";
  const counterparty = info.counterpartyName ?? "the counterparty";

  function switchWallet() {
    if (privy?.authenticated) privy.logout();
    disconnect();
  }

  return (
    <div className="border border-rule bg-card p-7">
      <div
        className="ds-eyebrow mb-2"
        style={{ color: "var(--color-accent)" }}
      >
        Wrong wallet
      </div>
      <h2
        className="font-serif font-normal"
        style={{ fontSize: 28, lineHeight: 1.15, letterSpacing: -0.5 }}
      >
        That&apos;s the wallet that{" "}
        <em className="text-accent not-italic">created</em> this deal.
      </h2>
      <p
        className="mt-2.5 max-w-md leading-relaxed text-ink/70"
        style={{ fontSize: 14 }}
      >
        You&apos;re signed in as <strong className="text-ink">{partyA}</strong>{" "}
        (
        <span className="font-mono" style={{ fontSize: 12 }}>
          {info.partyAWallet.slice(0, 6)}…{info.partyAWallet.slice(-4)}
        </span>
        ). The counterparty signature has to come from a different wallet —
        otherwise both sides of the escrow are controlled by the same key and
        there&apos;s no real second party to bind.
      </p>
      <p
        className="mt-2 max-w-md leading-relaxed text-ink/70"
        style={{ fontSize: 14 }}
      >
        Sign out and reconnect with the wallet you want to use as{" "}
        <strong className="text-ink">{counterparty}</strong>.
      </p>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={switchWallet}
          disabled={isPending}
          className="bg-ink px-5 py-3 text-paper disabled:opacity-50"
          style={{ fontSize: 13 }}
        >
          {isPending ? "Disconnecting…" : "Use a different wallet"}
        </button>
        <a
          href="/contracts"
          className="font-mono text-muted hover:text-ink"
          style={{ fontSize: 11, letterSpacing: 0.08 }}
        >
          Or open my contracts →
        </a>
      </div>
    </div>
  );
}

/// Banner on the receipt view when partyB ended up equal to partyA on-chain.
/// In production this shouldn't occur, but during testing people often sign
/// their own deal with the same wallet and then can't tell why the page
/// short-circuits to "held in escrow". Surface it explicitly so the receipt
/// doesn't masquerade as a real countersignature.
function SelfSignedBanner({ info }: { info: ContractInfo }) {
  return (
    <div
      className="mb-6 border bg-card p-5"
      style={{ borderColor: "var(--color-accent)" }}
    >
      <div
        className="ds-eyebrow mb-1.5"
        style={{ color: "var(--color-accent)" }}
      >
        Self-signed · test deal
      </div>
      <p
        className="max-w-2xl leading-relaxed text-ink/80"
        style={{ fontSize: 14 }}
      >
        Both parties on this escrow resolved to the same wallet (
        <span className="font-mono" style={{ fontSize: 12 }}>
          {info.partyAWallet.slice(0, 6)}…{info.partyAWallet.slice(-4)}
        </span>
        ). The signature and deposit went through, but a deal where one wallet
        controls both sides isn&apos;t enforceable in the way a real
        countersignature would be. To test the end-to-end flow, deploy a fresh
        deal and open the share link in a different wallet.
      </p>
    </div>
  );
}

function useSafePrivy() {
  try {
    return usePrivy();
  } catch {
    return null;
  }
}

function formatExpiry(deadlineSecs: number | null): string {
  if (!deadlineSecs) return "-";
  const days = Math.round((deadlineSecs * 1000 - Date.now()) / 86_400_000);
  if (days <= 0) return "expired";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function ReceiptRow({
  k,
  v,
  accent,
  last,
}: {
  k: string;
  v: string;
  accent?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className="flex justify-between"
      style={{
        padding: "6px 0",
        borderBottom: last ? "none" : "1px dashed var(--color-rule)",
      }}
    >
      <span className="text-muted">{k}</span>
      <span style={{ color: accent ? "var(--color-accent)" : undefined }}>
        {v}
      </span>
    </div>
  );
}
