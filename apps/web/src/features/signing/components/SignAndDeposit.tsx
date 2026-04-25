"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import { formatUnits } from "viem";
import { readSecretFromHash } from "@/lib/share-link";
import {
  buildAttestation,
  eip712Domain,
  eip712Types,
  newSalt,
} from "@/lib/attestation";
import { depositToken } from "@/lib/chain";
import { erc20Abi, escrowAbi } from "@/lib/contracts/abis";
import { EmailVerify } from "./EmailVerify";
import { SignaturePad } from "./SignaturePad";
import { WalletGate } from "./WalletGate";

type ContractInfo = {
  escrowAddress: `0x${string}`;
  title: string;
  pdfHash: `0x${string}`;
  partyAName: string | null;
  partyAWallet: `0x${string}`;
  counterpartyEmailMasked: string | null;
  counterpartyName: string | null;
  depositAmount: string; // human-readable
  depositToken: `0x${string}`;
  state: string;
};

type Stage =
  | "idle"
  | "approving"
  | "signing"
  | "submitting"
  | "done"
  | "error";

export function SignAndDeposit({
  escrowAddress,
}: {
  escrowAddress: string;
}) {
  const [secret, setSecret] = useState<`0x${string}` | null>(null);
  const [info, setInfo] = useState<ContractInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setSecret(readSecretFromHash());
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/contracts/${escrowAddress}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("not found"))))
      .then((d) => {
        if (!cancelled) setInfo(d as ContractInfo);
      })
      .catch((err: Error) => {
        if (!cancelled) setLoadError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [escrowAddress]);

  if (loadError) {
    return <p className="mt-4 text-sm text-red-400">Couldn&apos;t load this contract.</p>;
  }
  if (!info) {
    return <p className="mt-4 text-sm text-zinc-500">Loading contract…</p>;
  }
  if (!secret) {
    return (
      <p className="mt-4 text-sm text-amber-300">
        This link is missing its access secret. Ask Party A to resend the share
        link in full — the part after <code>#</code> is required.
      </p>
    );
  }

  if (info.state === "Active" || info.state === "Released" || info.state === "Releasing") {
    return (
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-emerald-300">✓ Already signed.</p>
        <p className="text-xs text-zinc-500">
          Status: <strong>{info.state}</strong>.
        </p>
      </div>
    );
  }

  return <CountersignFlow info={info} secret={secret} />;
}

function CountersignFlow({
  info,
  secret,
}: {
  info: ContractInfo;
  secret: `0x${string}`;
}) {
  return (
    <WalletGate>
      {(address) => <Inner info={info} secret={secret} wallet={address} />}
    </WalletGate>
  );
}

function Inner({
  info,
  secret,
  wallet,
}: {
  info: ContractInfo;
  secret: `0x${string}`;
  wallet: `0x${string}`;
}) {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [, setSig] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);

  const depositLabel = useMemo(
    () => `${info.depositAmount} ${depositToken.symbol}`,
    [info.depositAmount],
  );

  // On-chain `amount` is the source of truth — read it instead of trusting the off-chain index.
  const { data: onchainAmount } = useReadContract({
    address: info.escrowAddress,
    abi: escrowAbi,
    functionName: "amount",
  });

  const { data: balance } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });

  const { data: allowance } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet, info.escrowAddress],
  });

  const insufficient =
    onchainAmount !== undefined &&
    balance !== undefined &&
    (balance as bigint) < (onchainAmount as bigint);

  const ready =
    name.trim().length > 0 &&
    verifiedEmail === email &&
    onchainAmount !== undefined &&
    !insufficient;

  async function go() {
    if (!publicClient || onchainAmount === undefined) return;
    setError(null);
    try {
      // 1. Approve (if needed).
      const amt = onchainAmount as bigint;
      if ((allowance as bigint | undefined) === undefined || (allowance as bigint) < amt) {
        setStage("approving");
        const approveHash = await writeContractAsync({
          address: info.depositToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [info.escrowAddress, amt],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. EIP-712 sign attestation against the escrow's domain.
      setStage("signing");
      const nameSalt = newSalt();
      const emailSalt = newSalt();
      const attestation = buildAttestation({
        wallet,
        name: name.trim(),
        email,
        nameSalt,
        emailSalt,
        pdfHash: info.pdfHash,
      });
      const signature = await signTypedDataAsync({
        domain: eip712Domain(chainId, info.escrowAddress),
        types: eip712Types,
        primaryType: "Attestation",
        message: attestation,
      });
      setSig(signature);

      // 3. Submit countersign tx (consumes the URL secret + pulls the deposit).
      setStage("submitting");
      const txHash = await writeContractAsync({
        address: info.escrowAddress,
        abi: escrowAbi,
        functionName: "countersign",
        args: [secret, attestation, signature],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  if (stage === "done") {
    return (
      <div className="mt-4 space-y-2 text-sm">
        <p className="text-emerald-300">
          ✓ Signed. <strong>{depositLabel}</strong> is now held in escrow.
        </p>
        <p className="text-xs text-zinc-500">
          The funds release to {info.partyAName ?? "Party A"} only when both
          sides approve. Nothing has been paid out yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-4 text-sm">
      <div className="rounded-md border border-[color:var(--color-border)] p-3 text-xs">
        <Row k="Title" v={info.title} />
        <Row k="From" v={info.partyAName ?? `${info.partyAWallet.slice(0, 6)}…`} />
        <Row k="Addressed to" v={info.counterpartyEmailMasked ?? "—"} />
        <Row k="Deposit" v={depositLabel} />
        <Row k="Wallet" v={`${wallet.slice(0, 6)}…${wallet.slice(-4)}`} />
      </div>

      <Field label="Your full name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Jane Counterparty"
          className="w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
        />
      </Field>
      <Field label="Your email (verified for the audit certificate)">
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
        <EmailVerify initialEmail={email} onVerified={(v) => setVerifiedEmail(v)} />
      )}

      <div>
        <p className="mb-1 text-xs uppercase tracking-wide text-zinc-500">
          Your signature
        </p>
        <SignaturePad />
      </div>

      {insufficient && (
        <p className="text-xs text-amber-300">
          Wallet balance is below {depositLabel}. Top up before signing.{" "}
          {balance !== undefined && onchainAmount !== undefined && (
            <span>
              You have{" "}
              {formatUnits(balance as bigint, depositToken.decimals)}{" "}
              {depositToken.symbol}.
            </span>
          )}
        </p>
      )}

      <button
        type="button"
        disabled={!ready || stage !== "idle"}
        onClick={go}
        className="w-full rounded-md bg-[color:var(--color-accent)] px-4 py-2 font-medium text-black disabled:opacity-50"
      >
        {stage === "idle" && `Sign & deposit ${depositLabel}`}
        {stage === "approving" && "Approving token…"}
        {stage === "signing" && "Awaiting your signature…"}
        {stage === "submitting" && "Submitting…"}
        {stage === "error" && "Try again"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-zinc-500">
        Approve once, then sign the attestation. Deposit and signature land in
        the same transaction — that atomicity is the product.
      </p>
    </div>
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
