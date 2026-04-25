"use client";

import { useEffect, useState } from "react";
import { readSecretFromHash } from "@/lib/share-link";
import { BrandMark, PdfThumb, Seal } from "@/components/AppShell";
import { SignAndPay } from "./SignAndDeposit";
import { depositToken } from "@/lib/chain";

type ContractInfo = {
  escrowAddress: `0x${string}`;
  title: string;
  pdfHash: `0x${string}`;
  partyAName: string | null;
  partyAWallet: `0x${string}`;
  counterpartyEmailMasked: string | null;
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

  useEffect(() => {
    setSecret(readSecretFromHash());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contracts/${escrowAddress}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d) => {
        if (cancelled) return;
        setInfo(d as ContractInfo);
        if (
          d.state === "Active" ||
          d.state === "Releasing" ||
          d.state === "Released"
        ) {
          setView("done");
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [escrowAddress]);

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
  if (!secret && view !== "done") {
    return (
      <Frame>
        <p className="font-mono text-accent" style={{ fontSize: 13 }}>
          This link is missing its access secret. Ask Party A to resend the
          share link in full — the part after <code>#</code> is required.
        </p>
      </Frame>
    );
  }

  if (view === "landing") {
    return (
      <BLanding
        info={info}
        onContinue={() => setView("sign")}
      />
    );
  }
  if (view === "sign" && secret) {
    return (
      <BSignPay
        info={info}
        secret={secret}
        onDone={() => setView("done")}
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
  onContinue,
}: {
  info: ContractInfo;
  onContinue: () => void;
}) {
  return (
    <div className="min-h-screen bg-paper px-16 py-7">
      <div className="mb-5 flex items-center justify-between">
        <BrandMark />
        <span
          className="font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          Addressed to {info.counterpartyEmailMasked ?? "—"}
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
            <div
              className="mt-1 font-mono text-muted"
              style={{ fontSize: 11 }}
            >
              {info.partyAWallet.slice(0, 6)}…{info.partyAWallet.slice(-4)} ·
              on-chain reputation
            </div>

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
                      {depositToken.symbol}
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
                    {depositToken.symbol}
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
            <button
              type="button"
              onClick={onContinue}
              className="bg-ink px-6 py-3.5 text-paper"
              style={{ fontSize: 14 }}
            >
              Review the document →
            </button>
            <span
              className="font-mono text-muted"
              style={{ fontSize: 11 }}
            >
              (no wallet prompt yet)
            </span>
          </div>
        </div>

        <div className="border border-rule bg-card p-4.5">
          <div
            className="mb-3 flex justify-between font-mono uppercase text-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            <span>{info.title} — preview</span>
            <span>SHA256 · {info.pdfHash.slice(0, 6)}…{info.pdfHash.slice(-4)}</span>
          </div>
          <PdfThumb height={400} title={info.title} />
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
  return (
    <div className="min-h-screen bg-ink text-paper">
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
          <span className="text-ink-faint">① REVIEW ✓</span>
          <span className="text-paper">② SIGN &amp; PAY</span>
          <span className="text-ink-faint">③ DONE</span>
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

          <SignAndPay info={info} secret={secret} onDone={onDone} />
        </div>
      </div>
    </div>
  );
}

function BReceipt({ info }: { info: ContractInfo }) {
  return (
    <div className="min-h-screen bg-paper px-16 py-8">
      <div className="mb-6 flex items-center justify-between">
        <BrandMark />
        <div className="flex gap-6 font-mono" style={{ fontSize: 11 }}>
          <span className="text-muted">① REVIEW ✓</span>
          <span className="text-muted">② SIGN &amp; PAY ✓</span>
          <span className="text-accent">③ DONE</span>
        </div>
      </div>

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
            ✓ Sealed &amp; deposited
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
            when both of you approve. You can verify the deposit on-chain right
            now.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href="/contracts"
              className="bg-ink px-5 py-3.5 text-paper"
              style={{ fontSize: 14 }}
            >
              Open my contracts →
            </a>
            <a
              href={`/c/${info.escrowAddress}/release`}
              className="border border-ink px-5 py-3.5"
              style={{ fontSize: 14 }}
            >
              Manage release →
            </a>
            <a
              href={`https://testnet.snowtrace.io/address/${info.escrowAddress}`}
              target="_blank"
              rel="noreferrer"
              className="border border-ink px-5 py-3.5"
              style={{ fontSize: 14 }}
            >
              Verify on Snowtrace ↗
            </a>
          </div>
        </div>

        <div className="relative border border-rule bg-card p-6">
          <div className="absolute" style={{ top: -28, right: 24 }}>
            <Seal size={64} />
          </div>
          <div className="ds-eyebrow mb-2.5">Receipt · Atomic</div>
          <div className="font-mono" style={{ fontSize: 11, lineHeight: 2 }}>
            <ReceiptRow k="signed by" v={info.counterpartyName ?? "—"} />
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
              v={`${info.depositAmount} ${depositToken.symbol}`}
              accent
            />
            {info.totalDue && (
              <ReceiptRow
                k="totalDue"
                v={`${info.totalDue} ${depositToken.symbol}`}
              />
            )}
            <ReceiptRow k="release" v="requires both ✓" />
          </div>
          <a
            href={`/api/contracts/${info.escrowAddress}/pdf?signed=1`}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-between border border-rule px-4 py-3"
            style={{ fontSize: 13 }}
          >
            <span>Download signed PDF</span>
            <span
              className="font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              ↓
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

function formatExpiry(deadlineSecs: number | null): string {
  if (!deadlineSecs) return "—";
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
