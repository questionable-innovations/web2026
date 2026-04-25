"use client";

import { useMemo, useState } from "react";
import {
  usePublicClient,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import { parseUnits } from "viem";
import { sha256 } from "@/lib/ipfs";
import { newSecret, secretHash, shareLink } from "@/lib/share-link";
import {
  buildAttestation,
  eip712Domain,
  eip712Types,
  newSalt,
} from "@/lib/attestation";
import { activeChain, depositToken, escrowFactoryAddress } from "@/lib/chain";
import { escrowAbi, escrowFactoryAbi } from "@/lib/contracts/abis";
import { appendSignatureCertificate } from "@/lib/pdf-stamp";
import { EmailVerify } from "./EmailVerify";
import { PdfViewer } from "./PdfViewer";
import { SignaturePad } from "./SignaturePad";
import { WalletGate } from "./WalletGate";
import { PdfThumb, StateBadge } from "@/components/AppShell";

type Stage =
  | "details"
  | "identify"
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
  dealDeadline: number;
};

type Identity = {
  name: string;
  email: string;
};

type Result = {
  escrowAddress: `0x${string}`;
  secret: `0x${string}`;
  link: string;
};

const STEPS: [string, Stage[]][] = [
  ["Document", ["details"]],
  ["Terms", ["identify"]],
  ["Sign", ["sign", "deploying", "registering"]],
  ["Send", ["share"]],
];

export function PartyAFlow() {
  const [stage, setStage] = useState<Stage>("details");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const headerEyebrow =
    stage === "share"
      ? `Services agreement — ${details?.counterpartyName ?? "Counterparty"}`
      : "New contract · Draft";
  const headline =
    stage === "details"
      ? "What are you sealing?"
      : stage === "identify"
      ? "Verify yourself."
      : stage === "share"
      ? `You signed. Now send it to ${details?.counterpartyName ?? "your counterparty"}.`
      : "Sign and deploy.";

  return (
    <div>
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
          onNext={(d) => {
            setDetails(d);
            setStage("identify");
          }}
        />
      )}

      {stage === "identify" && details && (
        <IdentifyStep
          file={details.file}
          onBack={() => setStage("details")}
          onNext={(id) => {
            setIdentity(id);
            setStage("sign");
          }}
        />
      )}

      {(stage === "sign" || stage === "deploying" || stage === "registering") &&
        details &&
        identity && (
          <SignStep
            details={details}
            identity={identity}
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
              setStage(identity ? "sign" : details ? "identify" : "details");
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
              {isDone ? "✓" : i + 1}
            </span>
            {label}
          </span>
        );
      })}
    </div>
  );
}

function DetailsStep({ onNext }: { onNext: (d: Details) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("30");

  const deadlineLabel = useMemo(() => {
    const d = new Date(Date.now() + Number(days || 0) * 86400_000);
    return d.toISOString().slice(0, 10);
  }, [days]);

  return (
    <form
      className="grid gap-6"
      style={{ gridTemplateColumns: "1.4fr 1fr" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        onNext({
          file,
          title,
          counterpartyName,
          counterpartyEmail,
          amount,
          dealDeadline:
            Math.floor(Date.now() / 1000) + Number(days) * 86_400,
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
              {file ? file.name : "Choose a PDF…"}
            </div>
            <div
              className="mt-0.5 font-mono text-muted"
              style={{ fontSize: 11 }}
            >
              {file
                ? `${Math.round(file.size / 1024)} KB · will be hashed + pinned to IPFS`
                : "PDF only · max 10 MB"}
            </div>
          </div>
          <span className="font-mono text-accent" style={{ fontSize: 11 }}>
            {file ? "REPLACE" : "BROWSE"}
          </span>
          <input
            required
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <div className="mt-3">
          <FieldLabel>Title</FieldLabel>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Services Agreement — Acme × QInnovate"
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
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="4,800.00"
              className="flex-1 bg-transparent font-serif outline-none"
              style={{ fontSize: 32, lineHeight: 1 }}
            />
            <span
              className="font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1 }}
            >
              = {amount || "0"} {depositToken.symbol}
            </span>
          </div>
          <div>
            <FieldLabel>Deadline</FieldLabel>
            <div className="flex items-center gap-2 border border-rule bg-paper px-3.5 py-3 text-sm">
              <input
                inputMode="numeric"
                value={days}
                onChange={(e) =>
                  setDays(e.target.value.replace(/\D/g, "") || "0")
                }
                className="w-10 bg-transparent text-right outline-none"
              />
              <span className="text-muted">days · {deadlineLabel}</span>
            </div>
          </div>
        </div>

        <div
          className="mt-3 px-3.5 py-3 font-mono"
          style={{
            fontSize: 11,
            background: "var(--color-accent-soft)",
            color: "var(--color-ink)",
            lineHeight: 1.5,
          }}
        >
          <span className="text-accent">↳</span> Funds release only when both
          wallets approve. Neither side can withdraw alone.
        </div>

        <div className="mt-7 flex justify-between border-t border-rule-soft pt-6">
          <span className="border border-rule px-4 py-3 text-[13px] text-muted">
            ← Back to document
          </span>
          <button
            type="submit"
            disabled={!file}
            className="bg-ink px-5 py-3 text-[13px] text-paper disabled:opacity-50"
          >
            Continue to sign →
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
          <PdfThumb height={210} />
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
            <div>token &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {depositToken.symbol}</div>
            <div>amount &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; {amount || "—"}</div>
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

function IdentifyStep({
  file,
  onBack,
  onNext,
}: {
  file: File;
  onBack: () => void;
  onNext: (id: Identity) => void;
}) {
  const [name, setName] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const ready = name.trim().length > 0 && verifiedEmail !== null;

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="border border-rule bg-card p-3">
        <PdfViewer file={file} />
      </div>
      <div className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Your identity</div>
          <FieldLabel>Your full name</FieldLabel>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aroha @ QInnovate"
            className="ds-input"
          />
          <div style={{ height: 14 }} />
          <FieldLabel>Your email (verified)</FieldLabel>
          <EmailVerify onVerified={setVerifiedEmail} />
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="border border-rule px-4 py-3 text-[13px]"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() =>
              onNext({ name: name.trim(), email: verifiedEmail! })
            }
            className="bg-ink px-5 py-3 text-[13px] text-paper disabled:opacity-50"
          >
            Continue to sign →
          </button>
        </div>
      </div>
    </div>
  );
}

function SignStep({
  details,
  identity,
  stage,
  setStage,
  setError,
  onDone,
}: {
  details: Details;
  identity: Identity;
  stage: Stage;
  setStage: (s: Stage) => void;
  setError: (e: string | null) => void;
  onDone: (r: Result) => void;
}) {
  const chainId = activeChain.id;
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const factoryReady = useMemo(
    () =>
      escrowFactoryAddress !== "0x0000000000000000000000000000000000000000",
    [],
  );

  return (
    <WalletGate>
      {(address) => (
        <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
          <div className="border border-rule bg-card p-3">
            <PdfViewer file={details.file} />
          </div>
          <div className="space-y-4">
            <div className="border border-rule bg-card p-6">
              <div className="ds-eyebrow mb-3">Confirmation</div>
              <Summary
                details={details}
                identity={identity}
                wallet={address}
              />

              <div className="mt-5">
                <FieldLabel>Your signature</FieldLabel>
                <SignaturePad onChange={setSignatureDataUrl} />
              </div>

              {!factoryReady && (
                <p className="mt-3 font-mono text-accent" style={{ fontSize: 11 }}>
                  Set <code>NEXT_PUBLIC_ESCROW_FACTORY</code> to a deployed
                  EscrowFactory address.
                </p>
              )}
            </div>

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
                    wallet: address,
                    name: identity.name,
                    email: identity.email,
                    nameSalt,
                    emailSalt,
                    pdfHash,
                  });
                  const signature = await signTypedDataAsync({
                    domain: eip712Domain(chainId, predicted),
                    types: eip712Types,
                    primaryType: "Attestation",
                    message: attestation,
                  });

                  const dealDeadline = BigInt(details.dealDeadline);
                  const validUntil = dealDeadline;
                  const amountWei = parseUnits(
                    details.amount,
                    depositToken.decimals,
                  );

                  const txHash = await writeContractAsync({
                    address: escrowFactoryAddress,
                    abi: escrowFactoryAbi,
                    functionName: "createEscrowDeterministic",
                    args: [
                      salt,
                      depositToken.address,
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
                      pdfHash,
                      pdfCid: cid,
                      escrowAddress: predicted,
                      secretHash: sHash,
                      dealDeadline: details.dealDeadline,
                      partyA: {
                        wallet: address,
                        name: identity.name,
                        email: identity.email,
                        attestationHash: attestationStructHash,
                      },
                    }),
                  });
                  if (!res.ok) throw new Error("Failed to save contract index");

                  // Stamp Party A's Quick Sign certificate page onto a copy
                  // of the original PDF and pin it as the off-chain audit
                  // artifact. On-chain pdfHash stays anchored to the
                  // original (both parties attest to the same bytes).
                  if (signatureDataUrl) {
                    const stamped = await appendSignatureCertificate(buf, [
                      {
                        role: "Party A",
                        name: identity.name,
                        email: identity.email,
                        wallet: address,
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
                    }
                  }

                  onDone({
                    escrowAddress: predicted,
                    secret,
                    link: shareLink(predicted, secret),
                  });
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : "Something went wrong",
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
              ↳ Funds release only when both wallets approve. We never custody
              them.
            </p>
          </div>
        </div>
      )}
    </WalletGate>
  );
}

function Summary({
  details,
  identity,
  wallet,
}: {
  details: Details;
  identity: Identity;
  wallet: `0x${string}`;
}) {
  return (
    <dl className="font-mono" style={{ fontSize: 11, lineHeight: 1.8 }}>
      <Row k="Title" v={details.title} />
      <Row
        k="Counterparty"
        v={`${details.counterpartyName} · ${details.counterpartyEmail}`}
      />
      <Row k="Deposit" v={`${details.amount} ${depositToken.symbol}`} />
      <Row k="You" v={`${identity.name} · ${identity.email}`} />
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
          <span style={{ color: "var(--color-green)" }}>
            ✓ ATTESTATION ON-CHAIN
          </span>
        </div>
        <div className="px-8 py-6">
          <PdfThumb height={300} title={details.title} />
          <div
            className="mt-3.5 flex items-center gap-3.5 bg-paper px-4 py-3.5"
            style={{ border: "1px solid var(--color-accent)" }}
          >
            <div className="flex-1">
              <div
                className="font-mono uppercase text-muted"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                Signature — Party A
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
            <span
              className="font-mono"
              style={{ fontSize: 11, color: "var(--color-green)" }}
            >
              ✓
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
            The secret lives in the URL fragment — never sent to our server,
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
              className="font-mono text-accent"
              style={{ fontSize: 11 }}
            >
              SEND →
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
            <Row k="amount" v={`${details.amount} ${depositToken.symbol}`} />
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
            <span
              className="font-mono text-accent"
              style={{ fontSize: 10 }}
            >
              ↓
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
