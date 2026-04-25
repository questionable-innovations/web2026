"use client";

import { useMemo, useState } from "react";
import {
  usePublicClient,
  useReadContract,
  useSignTypedData,
  useWriteContract,
} from "wagmi";
import { formatUnits } from "viem";
import {
  buildAttestation,
  eip712Domain,
  eip712Types,
  newSalt,
} from "@/lib/attestation";
import { activeChain, depositToken } from "@/lib/chain";
import { erc20Abi, escrowAbi } from "@/lib/contracts/abis";
import { appendSignatureCertificate } from "@/lib/pdf-stamp";
import { SignaturePad } from "./SignaturePad";
import { WalletGate } from "./WalletGate";
import { ChainGate } from "./ChainGate";
import { ProfileGate, type Profile } from "./ProfileGate";
import { FundWalletPanel } from "./FundWalletPanel";

type ContractInfo = {
  escrowAddress: `0x${string}`;
  title: string;
  pdfHash: `0x${string}`;
  partyAName: string | null;
  partyAWallet: `0x${string}`;
  counterpartyEmailMasked: string | null;
  counterpartyName: string | null;
  depositAmount: string;
  depositToken: `0x${string}`;
  dealDeadline: number | null;
  state: string;
};

type Stage = "idle" | "approving" | "signing" | "submitting" | "error";

export function SignAndPay({
  info,
  secret,
  onDone,
}: {
  info: ContractInfo;
  secret: `0x${string}`;
  onDone: () => void;
}) {
  return (
    <WalletGate>
      {(address) => (
        <ProfileGate wallet={address}>
          {(profile) => (
            <ChainGate>
              <Inner
                info={info}
                secret={secret}
                wallet={address}
                profile={profile}
                onDone={onDone}
              />
            </ChainGate>
          )}
        </ProfileGate>
      )}
    </WalletGate>
  );
}

function Inner({
  info,
  secret,
  wallet,
  profile,
  onDone,
}: {
  info: ContractInfo;
  secret: `0x${string}`;
  wallet: `0x${string}`;
  profile: Profile;
  onDone: () => void;
}) {
  const chainId = activeChain.id;
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();

  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [inkDataUrl, setInkDataUrl] = useState<string | null>(null);

  const depositLabel = useMemo(
    () => `${info.depositAmount} ${depositToken.symbol}`,
    [info.depositAmount],
  );

  const { data: onchainAmount } = useReadContract({
    address: info.escrowAddress,
    abi: escrowAbi,
    functionName: "amount",
  });
  const { data: balance, refetch: refetchBalance } = useReadContract({
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
  // Source of truth: the token contract. Falls back to env until the
  // network read lands so the UI doesn't flash NaN.
  const { data: onchainDecimals } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const decimals =
    typeof onchainDecimals === "number" ? onchainDecimals : depositToken.decimals;

  const insufficient =
    onchainAmount !== undefined &&
    balance !== undefined &&
    (balance as bigint) < (onchainAmount as bigint);

  const wholeAmount = String(Math.floor(Number(info.depositAmount)));
  const confirmMatches = confirm === wholeAmount;

  const ready =
    inkDataUrl !== null &&
    onchainAmount !== undefined &&
    !insufficient &&
    confirmMatches;

  async function go() {
    if (!publicClient || onchainAmount === undefined) return;
    setError(null);
    try {
      const amt = onchainAmount as bigint;
      if (
        (allowance as bigint | undefined) === undefined ||
        (allowance as bigint) < amt
      ) {
        setStage("approving");
        const approveHash = await writeContractAsync({
          address: info.depositToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [info.escrowAddress, amt],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setStage("signing");
      const nameSalt = newSalt();
      const emailSalt = newSalt();
      const attestation = buildAttestation({
        wallet,
        name: profile.name,
        email: profile.email,
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

      setStage("submitting");
      const txHash = await writeContractAsync({
        address: info.escrowAddress,
        abi: escrowAbi,
        functionName: "countersign",
        args: [secret, attestation, signature],
      });
      await publicClient.waitForTransactionReceipt({ hash: txHash });

      const attestationStructHash = (await publicClient.readContract({
        address: info.escrowAddress,
        abi: escrowAbi,
        functionName: "hashAttestation",
        args: [attestation],
      })) as `0x${string}`;

      // Persist Party B's countersign to the off-chain index. State moves
      // Awaiting → Active here; partyBWallet now resolves on the dashboard.
      await fetch(`/api/contracts/${info.escrowAddress}/countersign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          partyB: {
            wallet,
            name: profile.name,
            email: profile.email,
            attestationHash: attestationStructHash,
          },
        }),
      });

      // Stamp B's Quick Sign block onto the existing signed PDF (which
      // carries A's block) and re-pin. On-chain pdfHash is unchanged —
      // it was always the original; the stamped artifact is the
      // human-readable audit copy (§4.3.7).
      try {
        const upstream = await fetch(
          `/api/contracts/${info.escrowAddress}/pdf?signed=1`,
        );
        if (upstream.ok && inkDataUrl) {
          const buf = await upstream.arrayBuffer();
          const stamped = await appendSignatureCertificate(buf, [
            {
              role: "Party B",
              name: profile.name,
              email: profile.email,
              wallet,
              attestationHash: attestationStructHash,
              signedAtUnix: Math.floor(Date.now() / 1000),
              signaturePngDataUrl: inkDataUrl,
            },
          ]);
          const fd = new FormData();
          fd.append(
            "file",
            new File(
              [
                new Blob([stamped as BlobPart], { type: "application/pdf" }),
              ],
              "contract-signed.pdf",
              { type: "application/pdf" },
            ),
          );
          const pin = await fetch("/api/ipfs", { method: "POST", body: fd });
          if (pin.ok) {
            const { cid: signedCid } = (await pin.json()) as { cid: string };
            await fetch(`/api/contracts/${info.escrowAddress}/signed`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ signedPdfCid: signedCid }),
            });
          }
        }
      } catch {
        // Non-fatal: the on-chain commitment is what matters; the
        // stamped artifact is best-effort.
      }

      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="border border-ink-rule bg-ink-card p-5">
        <div
          className="mb-3.5 flex items-baseline justify-between font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          <span>You will deposit</span>
          {balance !== undefined && (
            <span>
              balance:{" "}
              {formatUnits(balance as bigint, decimals)}{" "}
              {depositToken.symbol}
            </span>
          )}
        </div>
        <div className="font-serif" style={{ fontSize: 56, lineHeight: 1 }}>
          ${Number(info.depositAmount).toLocaleString()}
          <span className="text-ink-muted" style={{ fontSize: 18 }}>
            {" "}
            NZD
          </span>
        </div>
        <div
          className="mt-1.5 font-mono text-ink-soft"
          style={{ fontSize: 11 }}
        >
          = {depositLabel} · into escrow{" "}
          {info.escrowAddress.slice(0, 6)}…{info.escrowAddress.slice(-4)}
        </div>

        <div className="mt-5">
          <div
            className="mb-1.5 font-mono uppercase text-ink-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            Type the amount to confirm
          </div>
          <div
            className="flex items-center gap-2.5 px-3.5 py-3 font-mono text-paper"
            style={{
              background: "var(--color-ink)",
              border: `1px solid ${
                confirm.length === 0
                  ? "var(--color-ink-rule)"
                  : "var(--color-accent)"
              }`,
              fontSize: 14,
            }}
          >
            <span className="text-accent">$</span>
            <input
              inputMode="numeric"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value.replace(/\D/g, ""))}
              placeholder={wholeAmount}
              className="flex-1 bg-transparent text-paper outline-none placeholder:text-ink-faint"
            />
            <span className="text-ink-muted" style={{ fontSize: 11 }}>
              {confirmMatches ? "matches ✓" : `must equal ${wholeAmount}`}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-ink-rule bg-ink-card p-4">
        <div
          className="mb-2 flex items-baseline justify-between font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          <span>Signing as</span>
          <a href="/settings" className="text-accent">
            EDIT
          </a>
        </div>
        <div className="text-paper" style={{ fontSize: 14 }}>
          {profile.name}
        </div>
        <div
          className="mt-0.5 font-mono text-ink-soft"
          style={{ fontSize: 11 }}
        >
          {profile.email} · verified
        </div>
      </div>

      <div>
        <div
          className="mb-2 font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          Your signature
        </div>
        <div className="bg-paper p-2">
          <SignaturePad onChange={setInkDataUrl} />
        </div>
      </div>

      <div className="border border-ink-rule bg-ink-card p-4.5">
        <div
          className="mb-2.5 font-mono uppercase text-ink-muted"
          style={{ fontSize: 10, letterSpacing: 1 }}
        >
          You will sign over
        </div>
        <div
          className="font-mono text-ink-soft"
          style={{ fontSize: 11, lineHeight: 1.8 }}
        >
          <KV
            k="pdfHash"
            v={`${info.pdfHash.slice(0, 6)}…${info.pdfHash.slice(-4)}`}
          />
          <KV
            k="amount"
            v={`${info.depositAmount} ${depositToken.symbol}`}
            accent
          />
          <KV k="nameHash" v="0xa3…(salted)" />
          <KV k="chainId" v={`${chainId}`} />
        </div>
      </div>

      {insufficient && onchainAmount !== undefined && (
        <FundWalletPanel
          wallet={wallet}
          needed={onchainAmount as bigint}
          symbol={depositToken.symbol}
          decimals={decimals}
          refetchBalance={refetchBalance}
        />
      )}

      <button
        type="button"
        onClick={go}
        disabled={!ready || stage !== "idle"}
        className="flex w-full items-center justify-between bg-accent px-6 py-4 disabled:opacity-50"
        style={{ color: "#fff" }}
      >
        <div className="text-left">
          <div className="font-semibold" style={{ fontSize: 14 }}>
            {stage === "idle" && "Sign & deposit — one transaction"}
            {stage === "approving" && "Approving token…"}
            {stage === "signing" && "Awaiting your signature…"}
            {stage === "submitting" && "Submitting…"}
            {stage === "error" && "Try again"}
          </div>
          <div
            className="mt-1 font-mono opacity-85"
            style={{ fontSize: 11 }}
          >
            countersign(secret) + safeTransferFrom · atomic
          </div>
        </div>
        <span>→</span>
      </button>

      {error && (
        <p
          className="font-mono"
          style={{ fontSize: 11, color: "var(--color-accent)" }}
        >
          {error}
        </p>
      )}
      <p
        className="font-mono text-ink-muted"
        style={{ fontSize: 10, lineHeight: 1.5 }}
      >
        ↳ Funds release only when both you and{" "}
        {info.partyAName ?? "Party A"} approve. We never custody them.
      </p>
    </div>
  );
}

function KV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-ink-soft">{k}</span>
      <span className={accent ? "text-accent" : undefined}>{v}</span>
    </div>
  );
}
