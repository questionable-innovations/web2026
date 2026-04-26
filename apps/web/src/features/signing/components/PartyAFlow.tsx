"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  CornerDownRight,
} from "lucide-react";
import { usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import { useActiveWallet } from "@/lib/active-wallet";
import { sha256 } from "@/lib/ipfs";
import { newSecret, secretHash, shareLink } from "@/lib/share-link";
import {
  buildAttestation,
  eip712Domain,
  eip712Types,
  newSalt,
} from "@/lib/attestation";
import {
  activeChain,
  depositToken,
  depositTokens,
  escrowFactoryAddress,
  type DepositTokenConfig,
} from "@/lib/chain";
import { erc20Abi, escrowAbi, escrowFactoryAbi } from "@/lib/contracts/abis";
import { appendSignatureCertificate } from "@/lib/pdf-stamp";
import { isLocalhost } from "@/lib/isLocalhost";
import {
  decimalInputError,
  isPositiveDecimalInput,
  sanitizeDecimalInput,
} from "@/lib/input";
import { PdfViewer } from "./PdfViewer";
import { SignaturePad } from "./SignaturePad";
import { WalletGate } from "./WalletGate";
import { ChainGate } from "./ChainGate";
import { ProfileGate, type Profile } from "./ProfileGate";
import { PdfThumb, StateBadge } from "@/components/AppShell";

/// Default URL-link validity. Decoupled from the deal deadline because the
/// link is a bearer secret - keeping it valid for the full deal length
/// extends the phishing window unnecessarily. Counterparty has 7 days from
/// the sender pressing "share" to countersign; if they miss it, partyA
/// re-issues a link.
const LINK_VALIDITY_SECONDS = 7 * 86_400;

type Stage =
  | "details"
  | "sign"
  | "deploying"
  | "registering"
  | "share"
  | "error";

type Details = {
  file: File;
  title: string;
  counterpartyName: string;
  counterpartyEmail: string;
  amount: string;
  totalDue: string;
  depositToken: DepositTokenConfig;
  dealDeadline: number;
};

type Result = {
  escrowAddress: `0x${string}`;
  secret: `0x${string}`;
  link: string;
  signedPdfCid: string | null;
};

const STEPS: [string, Stage[]][] = [
  ["Document", ["details"]],
  ["Sign", ["sign", "deploying", "registering"]],
  ["Send", ["share"]],
];

function blockNonDecimalKey(e: KeyboardEvent<HTMLInputElement>) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const allowedControl = [
    "Backspace",
    "Delete",
    "ArrowLeft",
    "ArrowRight",
    "Tab",
    "Home",
    "End",
  ];
  if (allowedControl.includes(e.key)) return;
  if (e.key === "." || /^\d$/.test(e.key)) return;
  e.preventDefault();
}

/// Wallet-first entry point. Anyone uploading a PDF must first prove they
/// hold a wallet - that wallet becomes Party A's identity, the EIP-712
/// signer, and the address reputation accrues to.
export function PartyAFlow() {
  return (
    <WalletGate
      title="Sign in to seal a deal"
      blurb="DealSeal is wallet-first. Connect a wallet to upload your PDF; your signature, your deposit terms, and your reputation all anchor to it."
    >
      {(address) => (
        <ProfileGate wallet={address}>
          {(profile) => (
            <ChainGate>
              <Inner wallet={address} profile={profile} />
            </ChainGate>
          )}
        </ProfileGate>
      )}
    </WalletGate>
  );
}

function Inner({
  wallet,
  profile,
}: {
  wallet: `0x${string}`;
  profile: Profile;
}) {
  const [stage, setStage] = useState<Stage>("details");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const headerEyebrow =
    stage === "share"
      ? `Services agreement: ${details?.counterpartyName ?? "Counterparty"}`
      : "New contract · Draft";
  const headline =
    stage === "details"
      ? "What are you sealing?"
      : stage === "share"
      ? `You signed. Now send it to ${details?.counterpartyName ?? "your counterparty"}.`
      : "Sign and deploy.";

  return (
    <div>
      <div className="mb-6 flex items-center justify-between border border-rule bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper">
            <Check size={14} strokeWidth={2.2} />
          </span>
          <div>
            <div className="ds-eyebrow">Signed in as</div>
            <div style={{ fontSize: 13, lineHeight: 1.3 }}>
              <span style={{ fontWeight: 500 }}>{profile.name}</span>
              <span className="text-muted"> · {profile.email}</span>
            </div>
            <div className="font-mono text-muted" style={{ fontSize: 11 }}>
              {wallet}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/settings"
            className="font-mono text-accent"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            EDIT
          </a>
          <span
            className="font-mono uppercase text-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            {activeChain.name}
          </span>
        </div>
      </div>

      <div className="mb-8 flex items-baseline justify-between">
        <div>
          <div className="ds-eyebrow">{headerEyebrow}</div>
          <h1
            className="mt-1.5 font-serif font-normal"
            style={{ fontSize: 40, lineHeight: 1.15, letterSpacing: -0.8 }}
          >
            {headline}
          </h1>
        </div>
        {stage === "share" ? (
          <StateBadge state="Awaiting B" />
        ) : (
          <Steps current={stage} />
        )}
      </div>

      {stage === "details" && (
        <DetailsStep
          initial={details}
          onNext={(d) => {
            setDetails(d);
            setStage("sign");
          }}
        />
      )}

      {(stage === "sign" || stage === "deploying" || stage === "registering") &&
        details && (
          <SignStep
            wallet={wallet}
            details={details}
            profile={profile}
            stage={stage}
            setStage={setStage}
            setError={setError}
            onDone={(r) => {
              setResult(r);
              setStage("share");
            }}
          />
        )}

      {stage === "share" && result && details && (
        <ShareStep result={result} details={details} />
      )}

      {stage === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-accent">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStage(details ? "sign" : "details");
            }}
            className="border border-rule px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Stage }) {
  const idx = STEPS.findIndex(([, keys]) => keys.includes(current));
  return (
    <div className="flex items-center gap-3.5 font-mono" style={{ fontSize: 11 }}>
      {STEPS.map(([label], i) => {
        const isActive = i === idx;
        const isDone = i < idx;
        return (
          <span
            key={label}
            className="flex items-center gap-1.5"
            style={{
              color: isActive
                ? "var(--color-accent)"
                : isDone
                ? "var(--color-ink)"
                : "var(--color-muted)",
            }}
          >
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 18,
                height: 18,
                fontSize: 9,
                background: isDone ? "var(--color-ink)" : "transparent",
                color: isDone
                  ? "var(--color-paper)"
                  : isActive
                  ? "var(--color-accent)"
                  : "var(--color-muted)",
                border: isDone
                  ? "none"
                  : `1px solid ${
                      isActive ? "var(--color-accent)" : "var(--color-rule)"
                    }`,
              }}
            >
              {isDone ? <Check size={10} strokeWidth={2.5} /> : i + 1}
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function DetailsStep({
  onNext,
  initial,
}: {
  onNext: (d: Details) => void;
  initial: Details | null;
}) {
  const [file, setFile] = useState<File | null>(initial?.file ?? null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [counterpartyName, setCounterpartyName] = useState(
    initial?.counterpartyName ?? "",
  );
  const [counterpartyEmail, setCounterpartyEmail] = useState(
    initial?.counterpartyEmail ?? "",
  );
  const [amount, setAmount] = useState(() =>
    sanitizeDecimalInput(initial?.amount ?? ""),
  );
  const [totalDue, setTotalDue] = useState(() =>
    sanitizeDecimalInput(initial?.totalDue ?? ""),
  );
  const [depositTokenId, setDepositTokenId] = useState(
    initial?.depositToken.id ?? depositToken.id,
  );
  const [days, setDays] = useState(() => {
    if (!initial) return "";
    const remaining = Math.round(
      (initial.dealDeadline - Date.now() / 1000) / 86_400,
    );
    return String(Math.max(1, remaining));
  });
  const [formError, setFormError] = useState<string | null>(null);

  const loadDemo = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch("/demo-contract.pdf");
      if (!res.ok) throw new Error("Could not load demo contract");
      const blob = await res.blob();
      const demoFile = new File([blob], "Demo_Contract.pdf", {
        type: "application/pdf",
      });
      await handleFile(demoFile);
    } catch (err) {
      console.error("Demo load failed", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      alert(`Demo load failed: ${message}`);
      setIsAnalyzing(false);
    }
  };

  const handleFile = async (selectedFile: File | null) => {
    setFile(selectedFile);
    if (!selectedFile) return;

    setIsAnalyzing(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/extract-contract", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        if (data.title) setTitle(data.title);
        if (data.counterpartyName) setCounterpartyName(data.counterpartyName);
        if (data.counterpartyEmail) setCounterpartyEmail(data.counterpartyEmail);
        if (data.amount) setAmount(sanitizeDecimalInput(String(data.amount)));
        if (data.totalDue) {
          setTotalDue(sanitizeDecimalInput(String(data.totalDue)));
        }
        if (data.daysUntilDeadline) setDays(String(data.daysUntilDeadline));
      } else {
        const errText = await res.text();
        alert(`API Error: ${errText}`);
      }
    } catch (err: unknown) {
      console.error("AI Extraction failed", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      alert(`Network Error: ${errorMessage}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const selectedToken =
    depositTokens.find((token) => token.id === depositTokenId) ?? depositToken;
  const amountValid = isPositiveDecimalInput(amount);
  const totalDueValid = !totalDue || isPositiveDecimalInput(totalDue);
  const dayCount = Number(days);
  const daysValid =
    days.trim() !== "" && Number.isInteger(dayCount) && dayCount > 0;
  const canContinue = Boolean(file) && amountValid && totalDueValid && daysValid;
  const moneyError = !amount
    ? "Deposit is required."
    : !amountValid
      ? decimalInputError("Deposit")
      : totalDue && !totalDueValid
        ? decimalInputError("Total due")
        : null;
  const deadlineError =
    days && !daysValid ? "Deadline must be at least 1 day." : null;
  const visibleError =
    formError ??
    (amount && !amountValid ? decimalInputError("Deposit") : null) ??
    (totalDue && !totalDueValid ? decimalInputError("Total due") : null) ??
    deadlineError;

  const deadlineLabel = useMemo(() => {
    const safeDays = Math.max(1, Number(days || 1));
    const d = new Date(Date.now() + safeDays * 86400_000);
    return d.toISOString().slice(0, 10);
  }, [days]);

  return (
    <form
      className="grid gap-6"
      style={{ gridTemplateColumns: "1.4fr 1fr" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        if (!canContinue) {
          setFormError(moneyError ?? deadlineError ?? "Check the form details.");
          return;
        }
        setFormError(null);
        onNext({
          file,
          title,
          counterpartyName,
          counterpartyEmail,
          amount,
          totalDue,
          depositToken: selectedToken,
          dealDeadline: Math.floor(Date.now() / 1000) + dayCount * 86_400,
        });
      }}
    >
      <div className="border border-rule bg-card p-7">
        <div className="ds-eyebrow mb-2">Document</div>
        <label className="flex cursor-pointer items-center gap-3.5 border border-rule bg-paper px-4 py-3.5">
          <div
            className="relative"
            style={{
              width: 36,
              height: 44,
              background: "var(--color-card)",
              border: "1px solid var(--color-rule)",
            }}
          >
            <div style={{ position: "absolute", top: 6, left: 6, right: 6, height: 1, background: "rgba(10,10,10,0.2)" }} />
            <div style={{ position: "absolute", top: 10, left: 6, right: 12, height: 1, background: "rgba(10,10,10,0.2)" }} />
            <div style={{ position: "absolute", top: 14, left: 6, right: 8, height: 1, background: "rgba(10,10,10,0.2)" }} />
            <div
              className="absolute font-mono text-accent"
              style={{ bottom: 4, left: 6, fontSize: 6 }}
            >
              PDF
            </div>
          </div>
          <div className="flex-1">
            <div style={{ fontSize: 14 }}>
              {isAnalyzing ? "Analyzing PDF with AI..." : file ? file.name : "Choose a PDF…"}
            </div>
            <div
              className={`mt-0.5 font-mono ${isAnalyzing ? "text-accent animate-pulse" : "text-muted"}`}
              style={{ fontSize: 11 }}
            >
              {isAnalyzing 
                ? "Extracting details..."
                : file
                ? `${Math.round(file.size / 1024)} KB · will be hashed + pinned to IPFS`
                : "PDF only · max 10 MB"}
            </div>
          </div>
          <span className="font-mono text-accent" style={{ fontSize: 11 }}>
            {isAnalyzing ? "..." : file ? "REPLACE" : "BROWSE"}
          </span>
          <input
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            disabled={isAnalyzing}
          />
        </label>

        <button
          type="button"
          onClick={loadDemo}
          disabled={isAnalyzing}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 border border-accent bg-paper px-4 py-2.5 text-accent transition-colors hover:bg-accent hover:text-paper disabled:cursor-not-allowed disabled:opacity-50"
          style={{ fontSize: 12 }}
        >
          <CornerDownRight size={13} />
          <span>Or try the demo contract</span>
        </button>

        <div className="mt-3">
          <FieldLabel>Title</FieldLabel>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Services Agreement - Acme × QInnovate"
            className="ds-input"
          />
        </div>

        <div style={{ height: 22 }} />
        <div className="ds-eyebrow mb-2">Counterparty</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Their name</FieldLabel>
            <input
              required
              value={counterpartyName}
              onChange={(e) => setCounterpartyName(e.target.value)}
              placeholder="Bob Tomlinson"
              className="ds-input"
            />
          </div>
          <div>
            <FieldLabel>Their email</FieldLabel>
            <input
              required
              type="email"
              value={counterpartyEmail}
              onChange={(e) => setCounterpartyEmail(e.target.value)}
              placeholder="bob@acme.co.nz"
              className="ds-input"
            />
          </div>
        </div>

        <div style={{ height: 22 }} />
        <div className="ds-eyebrow mb-2">Total Due</div>
        <div
          className="flex items-baseline gap-2 bg-paper px-4 py-3.5"
          style={{ border: "1px solid var(--color-rule)" }}
        >
          <span className="font-mono text-muted" style={{ fontSize: 12 }}>
            NZD
          </span>
          <input
            inputMode="decimal"
            onKeyDown={blockNonDecimalKey}
            value={totalDue}
            onChange={(e) => {
              setFormError(null);
              setTotalDue(
                sanitizeDecimalInput(e.target.value, selectedToken.decimals),
              );
            }}
            aria-invalid={Boolean(totalDue && !totalDueValid)}
            placeholder="10,000.00"
            className="flex-1 bg-transparent font-serif outline-none"
            style={{ fontSize: 32, lineHeight: 1 }}
          />
          <span
            className="font-mono uppercase text-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            = {totalDue || "-"} {selectedToken.symbol}
          </span>
        </div>

        <div style={{ height: 22 }} />
        <div className="ds-eyebrow mb-2">Deposit</div>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "1.6fr 1fr" }}
        >
          <div
            className="flex items-baseline gap-2 bg-paper px-4 py-3.5"
            style={{ border: "1px solid var(--color-accent)" }}
          >
            <span className="font-mono text-muted" style={{ fontSize: 12 }}>
              NZD
            </span>
            <input
              required
              inputMode="decimal"
              onKeyDown={blockNonDecimalKey}
              value={amount}
              onChange={(e) => {
                setFormError(null);
                setAmount(
                  sanitizeDecimalInput(e.target.value, selectedToken.decimals),
                );
              }}
              aria-invalid={Boolean(amount && !amountValid)}
              placeholder="4,800.00"
              className="flex-1 bg-transparent font-serif outline-none"
              style={{ fontSize: 32, lineHeight: 1 }}
            />
            <span
              className="font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1 }}
            >
              = {amount || "-"} {selectedToken.symbol}
            </span>
          </div>
          <div>
            <FieldLabel>Deadline</FieldLabel>
            <div className="flex items-center gap-2 border border-rule bg-paper px-3.5 py-3 text-sm">
              <input
                inputMode="numeric"
                value={days}
                onChange={(e) => {
                  setFormError(null);
                  setDays(e.target.value.replace(/\D/g, ""));
                }}
                aria-invalid={Boolean(days && !daysValid)}
                className="w-10 bg-transparent text-right outline-none"
              />
              <span className="text-muted">days · {deadlineLabel}</span>
            </div>
          </div>
        </div>

        <div className="mt-3">
          <FieldLabel>Paying with</FieldLabel>
          <select
            value={depositTokenId}
            onChange={(e) => setDepositTokenId(e.target.value)}
            className="w-full border border-rule bg-paper px-3.5 py-3 font-mono outline-none"
            style={{ fontSize: 12 }}
          >
            {depositTokens.map((token) => (
              <option key={token.id} value={token.id}>
                {token.label} - {token.helper}
              </option>
            ))}
          </select>
        </div>

        {visibleError && (
          <p
            className="mt-3 font-mono text-accent"
            style={{ fontSize: 11, lineHeight: 1.5 }}
          >
            {visibleError}
          </p>
        )}

        <div
          className="mt-3 px-3.5 py-3 font-mono"
          style={{
            fontSize: 11,
            background: "var(--color-accent-soft)",
            color: "var(--color-ink)",
            lineHeight: 1.5,
          }}
        >
          <CornerDownRight size={12} className="text-accent inline-block mr-1 align-text-bottom" />
          Funds release only when both wallets approve. Neither side can withdraw alone.
        </div>

        <div className="mt-7 flex justify-between border-t border-rule-soft pt-6">
          <span className="inline-flex items-center gap-2 border border-rule px-4 py-3 text-[13px] text-muted">
            <ArrowLeft size={14} />
            Back to document
          </span>
          <button
            type="submit"
            disabled={!canContinue}
            className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-[13px] text-paper disabled:opacity-50"
          >
            Continue to sign
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div>
        <div className="border border-rule bg-card p-4.5">
          <div className="mb-2.5 flex justify-between">
            <span
              className="font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1 }}
            >
              Preview · {file ? "your PDF" : "page 1 of 4"}
            </span>
            <span
              className="font-mono text-accent"
              style={{ fontSize: 10 }}
            >
              Quick Sign
            </span>
          </div>
          {file ? <PdfViewer file={file} /> : <PdfThumb height={210} />}
        </div>
        <div className="mt-4 bg-ink p-5 text-paper">
          <div
            className="mb-2 font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.6)",
            }}
          >
            Will commit on chain
          </div>
          <div
            className="font-mono"
            style={{ fontSize: 11, lineHeight: 1.7 }}
          >
            <div>pdfHash &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; computed on next step</div>
            <div>token &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {selectedToken.symbol}</div>
            <div>amount &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {amount || "-"}</div>
            <div>partyA &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; you</div>
            <div>
              secret &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{" "}
              <span className="text-accent">generated on next step</span>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}

function SignStep({
  wallet,
  details,
  profile,
  stage,
  setStage,
  setError,
  onDone,
}: {
  wallet: `0x${string}`;
  details: Details;
  profile: Profile;
  stage: Stage;
  setStage: (s: Stage) => void;
  setError: (e: string | null) => void;
  onDone: (r: Result) => void;
}) {
  const showRawErrors = isLocalhost();
  const chainId = activeChain.id;
  const publicClient = usePublicClient();
  const { writeContract, signTypedData } = useActiveWallet();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [stampedFile, setStampedFile] = useState<File | null>(null);

  useEffect(() => {
    let canceled = false;
    async function stampPreview() {
      if (!details.file) return;
      try {
        const buf = await details.file.arrayBuffer();
        
        let stampedBytes: Uint8Array | null = null;
        
        // Always generate the timestamp page in "sign" preview with the live signature
        stampedBytes = await appendSignatureCertificate(buf, [
          {
            role: "Party A",
            name: profile.name,
            email: profile.email,
            wallet,
            attestationHash: "0x0000000000000000000000000000000000000000000000000000000000000000",
            signedAtUnix: Math.floor(Date.now() / 1000),
            // Pass the current signature pad data, or a blank "placeholder" if none yet
            signaturePngDataUrl: signatureDataUrl || "",
          },
        ]);

        if (!canceled && stampedBytes) {
          const blob = new Blob([stampedBytes as BlobPart], { type: "application/pdf" });
          const newFile = new File([blob], details.file.name.replace(".pdf", "-stamped.pdf"), { type: "application/pdf" });
          setStampedFile(newFile);
        }
      } catch (err) {
        console.error("Preview stamp error", err);
      }
    }
    stampPreview();
    return () => {
      canceled = true;
    };
  }, [details.file, signatureDataUrl, profile.name, profile.email, wallet]);

  const factoryReady = useMemo(
    () =>
      escrowFactoryAddress !== "0x0000000000000000000000000000000000000000",
    [],
  );

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="border border-rule bg-card p-3">
        <PdfViewer file={stampedFile || details.file} />
      </div>
      <div className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Confirmation</div>
          <Summary details={details} profile={profile} wallet={wallet} />

          <div className="mt-5">
            <FieldLabel>Your signature</FieldLabel>
            <SignaturePad onChange={setSignatureDataUrl} />
          </div>

          {!factoryReady && (
            <p
              className="mt-3 font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              Set <code>NEXT_PUBLIC_ESCROW_FACTORY</code> to a deployed
              EscrowFactory address.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={stage !== "sign"}
          onClick={() => setStage("details")}
          className="inline-flex w-full items-center justify-center gap-2 border border-rule px-5 py-3 text-ink disabled:opacity-50"
          style={{ fontSize: 13 }}
        >
          <ArrowLeft size={14} />
          Back to details
        </button>

        <button
          type="button"
          disabled={
            !factoryReady ||
            !signatureDataUrl ||
            stage !== "sign" ||
            !publicClient
          }
          className="w-full bg-accent px-5 py-4 text-paper disabled:opacity-50"
          style={{ color: "#fff" }}
          onClick={async () => {
            if (!publicClient) return;
            setError(null);
            try {
              setStage("deploying");
              const buf = await details.file.arrayBuffer();
              const pdfHash = (await sha256(buf)) as `0x${string}`;

              const fd = new FormData();
              fd.append("file", details.file);
              const upload = await fetch("/api/ipfs", {
                method: "POST",
                body: fd,
              });
              if (!upload.ok) throw new Error("IPFS pin failed");
              const { cid } = (await upload.json()) as { cid: string };

              const secret = newSecret();
              const sHash = secretHash(secret);
              const nameSalt = newSalt();
              const emailSalt = newSalt();

              const salt = newSalt();
              const predicted = (await publicClient.readContract({
                address: escrowFactoryAddress,
                abi: escrowFactoryAbi,
                functionName: "predictAddress",
                args: [salt],
              })) as `0x${string}`;

              const attestation = buildAttestation({
                wallet,
                name: profile.name,
                email: profile.email,
                nameSalt,
                emailSalt,
                pdfHash,
              });
              const signature = await signTypedData({
                domain: eip712Domain(chainId, predicted),
                types: eip712Types,
                primaryType: "Attestation",
                message: attestation,
              });

              const dealDeadline = BigInt(details.dealDeadline);
              // Link validity is decoupled from the deal deadline. The
              // contract enforces validUntil <= deadline, so we clamp.
              const linkExpiry = BigInt(
                Math.floor(Date.now() / 1000) + LINK_VALIDITY_SECONDS,
              );
              const validUntil =
                linkExpiry < dealDeadline ? linkExpiry : dealDeadline;
              // Read decimals from chain - env-derived decimals risk an
              // off-by-10^n bug if misconfigured.
              const decimals = (await publicClient.readContract({
                address: details.depositToken.address,
                abi: erc20Abi,
                functionName: "decimals",
              })) as number;
              const amountWei = parseUnits(details.amount, decimals);

              const txHash = await writeContract({
                address: escrowFactoryAddress,
                abi: escrowFactoryAbi,
                functionName: "createEscrowDeterministic",
                args: [
                  salt,
                  details.depositToken.address,
                  amountWei,
                  pdfHash,
                  cid,
                  dealDeadline,
                  validUntil,
                  sHash,
                  attestation,
                  signature,
                ],
              });
              await publicClient.waitForTransactionReceipt({ hash: txHash });

              setStage("registering");
              const attestationStructHash = (await publicClient.readContract({
                address: predicted,
                abi: escrowAbi,
                functionName: "hashAttestation",
                args: [attestation],
              })) as `0x${string}`;

              const res = await fetch("/api/contracts", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  title: details.title,
                  counterpartyEmail: details.counterpartyEmail,
                  counterpartyName: details.counterpartyName,
                  amount: details.amount,
                  depositToken: details.depositToken.address,
                  totalDue: details.totalDue || undefined,
                  pdfHash,
                  pdfCid: cid,
                  escrowAddress: predicted,
                  secretHash: sHash,
                  dealDeadline: details.dealDeadline,
                  partyA: {
                    wallet,
                    name: profile.name,
                    email: profile.email,
                    attestationHash: attestationStructHash,
                  },
                }),
              });
              if (!res.ok) throw new Error("Failed to save contract index");

              let signedPdfCid: string | null = null;
              if (signatureDataUrl) {
                const stamped = await appendSignatureCertificate(buf, [
                  {
                    role: "Party A",
                    name: profile.name,
                    email: profile.email,
                    wallet,
                    attestationHash: attestationStructHash,
                    signedAtUnix: Math.floor(Date.now() / 1000),
                    signaturePngDataUrl: signatureDataUrl,
                  },
                ]);
                const stampedFd = new FormData();
                stampedFd.append(
                  "file",
                  new File(
                    [
                      new Blob([stamped as BlobPart], {
                        type: "application/pdf",
                      }),
                    ],
                    `${details.title || "contract"}-signed.pdf`,
                    { type: "application/pdf" },
                  ),
                );
                const stampedRes = await fetch("/api/ipfs", {
                  method: "POST",
                  body: stampedFd,
                });
                if (stampedRes.ok) {
                  const { cid: signedCid } = (await stampedRes.json()) as {
                    cid: string;
                  };
                  await fetch(`/api/contracts/${predicted}/signed`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ signedPdfCid: signedCid }),
                  });
                  signedPdfCid = signedCid;
                }
              }

              onDone({
                escrowAddress: predicted,
                secret,
                link: shareLink(predicted, secret),
                signedPdfCid,
              });
            } catch (err) {
              setError(
                showRawErrors
                  ? err instanceof Error
                    ? err.message
                    : "Something went wrong"
                  : "An error occurred.",
              );
              setStage("error");
            }
          }}
        >
          <div className="text-left">
            <div className="text-[14px] font-semibold">
              {stage === "sign" && "Sign & deploy escrow"}
              {stage === "deploying" && "Submitting tx…"}
              {stage === "registering" && "Saving…"}
            </div>
            <div
              className="mt-1 font-mono opacity-80"
              style={{ fontSize: 11 }}
            >
              countersign(secret) + safeTransferFrom · atomic
            </div>
          </div>
        </button>
        <p
          className="font-mono text-muted"
          style={{ fontSize: 11, lineHeight: 1.5 }}
        >
          <CornerDownRight size={12} className="inline-block mr-1 align-text-bottom" />
          Funds release only when both wallets approve. We never custody them.
        </p>
      </div>
    </div>
  );
}

/// Used inside the dashboard summary; pulls wallet from context so we can
/// render outside of an explicit prop.
export function useConnectedAccount() {
  const { address } = useActiveWallet();
  return address;
}

function Summary({
  details,
  profile,
  wallet,
}: {
  details: Details;
  profile: Profile;
  wallet: `0x${string}`;
}) {
  return (
    <dl className="font-mono" style={{ fontSize: 11, lineHeight: 1.8 }}>
      <Row k="Title" v={details.title} />
      <Row
        k="Counterparty"
        v={`${details.counterpartyName} · ${details.counterpartyEmail}`}
      />
      <Row
        k="Total Due"
        v={`${details.totalDue || "-"} ${details.depositToken.symbol}`}
      />
      <Row k="Deposit" v={`${details.amount} ${details.depositToken.symbol}`} />
      <Row k="You" v={`${profile.name} · ${profile.email}`} />
      <Row k="Wallet" v={`${wallet.slice(0, 6)}…${wallet.slice(-4)}`} />
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function ShareStep({
  result,
  details,
}: {
  result: Result;
  details: Details;
}) {
  const [copied, setCopied] = useState(false);
  const trimmedAddr = `${result.escrowAddress.slice(0, 6)}…${result.escrowAddress.slice(-4)}`;
  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1fr 0.9fr" }}>
      <div className="border border-rule bg-card">
        <div
          className="flex justify-between border-b border-rule px-4 py-3.5 font-mono uppercase text-muted"
          style={{ fontSize: 11, letterSpacing: 1 }}
        >
          <span>SIGNED · {new Date().toISOString().slice(0, 10)}</span>
          <span className="inline-flex items-center gap-1.5" style={{ color: "var(--color-green)" }}>
            <Check size={12} strokeWidth={2.5} />
            ATTESTATION ON-CHAIN
          </span>
        </div>
        <div className="px-8 py-6">
          <PdfViewer
            escrowAddress={result.escrowAddress}
            signed={Boolean(result.signedPdfCid)}
          />
          <div
            className="mt-3.5 flex items-center gap-3.5 bg-paper px-4 py-3.5"
            style={{ border: "1px solid var(--color-accent)" }}
          >
            <div className="flex-1">
              <div
                className="font-mono uppercase text-muted"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                Signature - Party A
              </div>
              <svg
                width="200"
                height="34"
                viewBox="0 0 200 34"
                style={{ marginTop: 4, display: "block" }}
              >
                <path
                  d="M 4 24 C 14 4, 26 30, 36 16 S 56 2, 70 22 S 100 30, 118 12 S 150 24, 168 10 S 188 22, 196 14"
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <span style={{ color: "var(--color-green)" }}>
              <Check size={14} strokeWidth={2.5} />
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow">Send to counterparty</div>
          <div className="mt-1.5 mb-3.5 font-serif" style={{ fontSize: 26, lineHeight: 1.1, letterSpacing: -0.4 }}>
            {details.counterpartyName}
            <br />
            <span className="text-muted" style={{ fontSize: 18 }}>
              {details.counterpartyEmail}
            </span>
          </div>

          <div
            className="flex items-center gap-2 bg-paper font-mono"
            style={{
              padding: "10px 12px",
              border: "1px solid var(--color-rule)",
              fontSize: 11,
            }}
          >
            <span className="text-muted truncate">
              {result.link.split("#")[0]}
            </span>
            <span className="text-accent">#secret</span>
            <button
              type="button"
              onClick={async () => {
                await navigator.clipboard.writeText(result.link);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="ml-auto text-accent"
              style={{ fontSize: 10 }}
            >
              {copied ? "COPIED" : "COPY"}
            </button>
          </div>
          <div
            className="mt-2 font-mono text-muted"
            style={{ fontSize: 10, lineHeight: 1.5 }}
          >
            The secret lives in the URL fragment - never sent to our server,
            never indexed.
          </div>

          <a
            href={`mailto:${details.counterpartyEmail}?subject=${encodeURIComponent(`Sign & seal: ${details.title}`)}&body=${encodeURIComponent(result.link)}`}
            className="mt-4 flex items-center justify-between bg-ink px-4 py-3.5 text-paper"
          >
            <span style={{ fontSize: 13 }}>
              Email {details.counterpartyName.split(" ")[0]} the link
            </span>
            <span
              className="inline-flex items-center gap-1.5 font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              SEND
              <ArrowRight size={12} />
            </span>
          </a>
        </div>

        <div
          className="bg-paper p-4"
          style={{ border: "1px solid var(--color-rule)" }}
        >
          <div className="ds-eyebrow mb-2">On-chain</div>
          <div className="font-mono" style={{ fontSize: 11, lineHeight: 1.8 }}>
            <Row k="escrow" v={trimmedAddr} />
            <Row k="amount" v={`${details.amount} ${details.depositToken.symbol}`} />
            <Row
              k="total due"
              v={`${details.totalDue || "-"} ${details.depositToken.symbol}`}
            />
            <Row
              k="validUntil"
              v={`+${Math.round(
                (details.dealDeadline - Date.now() / 1000) / 86400,
              )} days`}
            />
          </div>
          <a
            href={`/api/contracts/${result.escrowAddress}/pdf?signed=1`}
            target="_blank"
            rel="noreferrer"
            className="mt-3 flex items-center justify-between border border-rule px-3.5 py-2.5"
            style={{ fontSize: 12 }}
          >
            <span>View signed PDF</span>
            <span className="text-accent">
              <ArrowDown size={14} />
            </span>
          </a>
          <a
            href={`https://testnet.snowtrace.io/address/${result.escrowAddress}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 flex items-center justify-between border border-rule px-3.5 py-2.5"
            style={{ fontSize: 12 }}
          >
            <span>Verify on Snowtrace</span>
            <span className="text-accent">
              <ArrowUpRight size={14} />
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-muted" style={{ fontSize: 11 }}>
      {children}
    </div>
  );
}
