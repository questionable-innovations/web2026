"use client";

import { useMemo, useState } from "react";
import {
  useChainId,
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
import { depositToken, escrowFactoryAddress } from "@/lib/chain";
import { escrowFactoryAbi } from "@/lib/contracts/abis";
import { EmailVerify } from "./EmailVerify";
import { PdfViewer } from "./PdfViewer";
import { SignaturePad } from "./SignaturePad";
import { WalletGate } from "./WalletGate";

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
  amount: string; // human-readable, e.g. "2500"
  dealDeadline: number; // unix seconds
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

export function PartyAFlow() {
  const [stage, setStage] = useState<Stage>("details");
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<Details | null>(null);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  return (
    <div className="space-y-6">
      <Steps current={stage} />

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

      {stage === "share" && result && details && <ShareStep result={result} details={details} />}

      {stage === "error" && (
        <div className="space-y-3">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setStage(identity ? "sign" : details ? "identify" : "details");
            }}
            className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function Steps({ current }: { current: Stage }) {
  const items: { key: Stage[]; label: string }[] = [
    { key: ["details"], label: "Details" },
    { key: ["identify"], label: "Verify" },
    { key: ["sign", "deploying", "registering"], label: "Sign & deploy" },
    { key: ["share"], label: "Share" },
  ];
  return (
    <ol className="flex items-center gap-2 text-xs text-zinc-500">
      {items.map((it, i) => {
        const active = it.key.includes(current);
        return (
          <li key={i} className="flex items-center gap-2">
            <span
              className={
                active
                  ? "rounded-full bg-[color:var(--color-accent)] px-2 py-0.5 text-black"
                  : "rounded-full border border-[color:var(--color-border)] px-2 py-0.5"
              }
            >
              {i + 1}. {it.label}
            </span>
            {i < items.length - 1 && <span>→</span>}
          </li>
        );
      })}
    </ol>
  );
}

function DetailsStep({ onNext }: { onNext: (d: Details) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [counterpartyEmail, setCounterpartyEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("30");

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!file) return;
        const dealDeadline =
          Math.floor(Date.now() / 1000) + Number(days) * 86_400;
        onNext({
          file,
          title,
          counterpartyName,
          counterpartyEmail,
          amount,
          dealDeadline,
        });
      }}
    >
      <Field label="PDF">
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
      </Field>
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Engagement letter — Acme Co"
        />
      </Field>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Counterparty name">
          <input
            required
            value={counterpartyName}
            onChange={(e) => setCounterpartyName(e.target.value)}
            className="input"
            placeholder="Jane Doe"
          />
        </Field>
        <Field label="Counterparty email">
          <input
            required
            type="email"
            value={counterpartyEmail}
            onChange={(e) => setCounterpartyEmail(e.target.value)}
            className="input"
            placeholder="jane@acme.co"
          />
        </Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label={`Deposit (${depositToken.symbol})`}>
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="input"
            placeholder="2500"
          />
        </Field>
        <Field label="Counterpart link expires (days)">
          <input
            required
            inputMode="numeric"
            value={days}
            onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
            className="input"
            placeholder="30"
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={!file}
        className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
      >
        Continue →
      </button>

      <style jsx>{`
        .input {
          width: 100%;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 10px 12px;
          color: inherit;
        }
      `}</style>
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
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);

  const ready = name.trim() && verifiedEmail && verifiedEmail === email;

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
        <PdfViewer file={file} />
      </div>
      <div className="space-y-4">
        <Field label="Your full name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Alex Contractor"
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
          />
        </Field>
        <Field label="Your email (verified)">
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setVerifiedEmail(null);
            }}
            placeholder="you@company.co"
            className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
          />
        </Field>
        {email.includes("@") && (
          <EmailVerify
            initialEmail={email}
            onVerified={(v) => setVerifiedEmail(v)}
          />
        )}

        <div className="flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="text-sm text-zinc-400 underline"
          >
            ← Back
          </button>
          <button
            type="button"
            disabled={!ready}
            onClick={() => onNext({ name: name.trim(), email })}
            className="rounded-md bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            Continue →
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
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const factoryReady = useMemo(
    () => escrowFactoryAddress !== "0x0000000000000000000000000000000000000000",
    [],
  );

  return (
    <WalletGate>
      {(address) => (
        <div className="grid gap-6 md:grid-cols-[1fr_320px]">
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
            <PdfViewer file={details.file} />
          </div>
          <div className="space-y-4 text-sm">
            <Summary
              details={details}
              identity={identity}
              wallet={address}
            />

            <div>
              <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
                Your signature
              </p>
              <SignaturePad onChange={setSignatureDataUrl} />
            </div>

            {!factoryReady && (
              <p className="text-xs text-amber-300">
                Set <code>NEXT_PUBLIC_ESCROW_FACTORY</code> to a deployed
                EscrowFactory address.
              </p>
            )}

            <button
              type="button"
              disabled={
                !factoryReady ||
                !signatureDataUrl ||
                stage !== "sign" ||
                !publicClient
              }
              className="w-full rounded-md bg-[color:var(--color-accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
              onClick={async () => {
                if (!publicClient) return;
                setError(null);
                try {
                  // 1. Hash + pin the PDF.
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

                  // 2. Build URL secret + per-attestation salts.
                  const secret = newSecret();
                  const sHash = secretHash(secret);
                  const nameSalt = newSalt();
                  const emailSalt = newSalt();

                  // 3. Predict the deterministic clone address so the EIP-712
                  //    domain (verifyingContract) matches what the contract
                  //    will recompute post-deploy.
                  const salt = newSalt();
                  const predicted = (await publicClient.readContract({
                    address: escrowFactoryAddress,
                    abi: escrowFactoryAbi,
                    functionName: "predictAddress",
                    args: [salt],
                  })) as `0x${string}`;

                  // 4. Build attestation + sign.
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

                  // 5. Submit deploy tx.
                  const dealDeadline = BigInt(details.dealDeadline);
                  const validUntil = dealDeadline; // matches the URL expiry.
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

                  // 6. Persist off-chain index.
                  setStage("registering");
                  const attestationStructHash = await publicClient.readContract({
                    address: predicted,
                    abi: [
                      {
                        type: "function",
                        name: "hashAttestation",
                        stateMutability: "pure",
                        inputs: [
                          {
                            type: "tuple",
                            components: [
                              { name: "wallet", type: "address" },
                              { name: "nameHash", type: "bytes32" },
                              { name: "emailHash", type: "bytes32" },
                              { name: "pdfHash", type: "bytes32" },
                              { name: "nonce", type: "uint256" },
                              { name: "deadline", type: "uint256" },
                            ],
                          },
                        ],
                        outputs: [{ type: "bytes32" }],
                      },
                    ] as const,
                    functionName: "hashAttestation",
                    args: [attestation],
                  });

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
                      partyA: {
                        wallet: address,
                        name: identity.name,
                        email: identity.email,
                        attestationHash: attestationStructHash,
                      },
                    }),
                  });
                  if (!res.ok) throw new Error("Failed to save contract index");

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
              {stage === "sign" && "Sign & deploy escrow"}
              {stage === "deploying" && "Submitting tx…"}
              {stage === "registering" && "Saving…"}
            </button>
            <p className="text-xs text-zinc-500">
              You&apos;ll be asked to sign a typed-data message, then approve a
              single deploy transaction.
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
    <dl className="rounded-md border border-[color:var(--color-border)] p-3 text-xs">
      <Row k="Title" v={details.title} />
      <Row k="Counterparty" v={`${details.counterpartyName} · ${details.counterpartyEmail}`} />
      <Row
        k="Deposit"
        v={`${details.amount} ${depositToken.symbol}`}
      />
      <Row k="You" v={`${identity.name} · ${identity.email}`} />
      <Row k="Wallet" v={`${wallet.slice(0, 6)}…${wallet.slice(-4)}`} />
    </dl>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="text-right">{v}</dd>
    </div>
  );
}

function ShareStep({ result, details }: { result: Result; details: Details }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-300">
        ✓ Escrow deployed at{" "}
        <code>
          {result.escrowAddress.slice(0, 6)}…{result.escrowAddress.slice(-4)}
        </code>
        . Send the link below to {details.counterpartyName} (
        {details.counterpartyEmail}) — they sign and deposit in one tap.
      </p>
      <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
        <p className="break-all font-mono text-xs">{result.link}</p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(result.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-2 text-sm font-medium text-black"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <a
          href={result.link}
          target="_blank"
          rel="noreferrer"
          className="rounded-md border border-[color:var(--color-border)] px-3 py-2 text-sm"
        >
          Open as Party B (test)
        </a>
      </div>
      <p className="text-xs text-zinc-500">
        The bit after <code>#</code> is the access secret — it never reaches
        our server. Keep it in the URL.
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}
