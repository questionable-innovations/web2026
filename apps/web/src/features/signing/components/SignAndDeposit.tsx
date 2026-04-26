"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Check, CornerDownRight } from "lucide-react";
import { usePublicClient, useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useActiveWallet } from "@/lib/active-wallet";
import {
  buildAttestation,
  eip712Domain,
  eip712Types,
  newSalt,
} from "@/lib/attestation";
import { activeChain, getDepositTokenByAddress } from "@/lib/chain";
import { erc20Abi, escrowAbi } from "@/lib/contracts/abis";
import { appendSignatureCertificate } from "@/lib/pdf-stamp";
import { isLocalhost } from "@/lib/isLocalhost";
import { sanitizeDecimalInput } from "@/lib/input";
import { SignaturePad } from "./SignaturePad";
import { type Profile } from "./ProfileGate";
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

/// The actual sign+deposit form. Assumes wallet/profile/chain gates have
/// already passed - callers must wrap this in WalletGate + ProfileGate +
/// ChainGate (or otherwise satisfy those preconditions) before rendering.
/// Designed to be rendered against a dark (bg-ink) surface; uses the
/// ink-card / ink-rule palette throughout.
export function SignAndPayForm({
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
  const showRawErrors = isLocalhost();
  const chainId = activeChain.id;
  // Pin to the configured chain. Default `usePublicClient()` follows the
  // wallet's current chain, which can drift past ChainGate (e.g. wallet
  // network switch mid-flow) and silently route reads to the wrong RPC.
  const publicClient = usePublicClient({ chainId });
  const { writeContract, signTypedData } = useActiveWallet();

  const [confirm, setConfirm] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [inkDataUrl, setInkDataUrl] = useState<string | null>(null);
  const selectedToken = useMemo(
    () => getDepositTokenByAddress(info.depositToken),
    [info.depositToken],
  );

  const depositLabel = useMemo(
    () => `${info.depositAmount} ${selectedToken.symbol}`,
    [info.depositAmount, selectedToken.symbol],
  );

  const { data: onchainAmount } = useReadContract({
    address: info.escrowAddress,
    abi: escrowAbi,
    functionName: "amount",
    chainId,
  });
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
    chainId,
  });
  const { data: allowance } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "allowance",
    args: [wallet, info.escrowAddress],
    chainId,
  });
  // Source of truth: the token contract. Falls back to env until the
  // network read lands so the UI doesn't flash NaN.
  const { data: onchainDecimals } = useReadContract({
    address: info.depositToken,
    abi: erc20Abi,
    functionName: "decimals",
    chainId,
  });
  const decimals =
    typeof onchainDecimals === "number"
      ? onchainDecimals
      : selectedToken.decimals;

  const insufficient =
    onchainAmount !== undefined &&
    balance !== undefined &&
    (balance as bigint) < (onchainAmount as bigint);

  const exactAmount = String(info.depositAmount);
  const confirmMatches = confirm === exactAmount;

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
        const approveHash = await writeContract({
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
      const signature = await signTypedData({
        domain: eip712Domain(chainId, info.escrowAddress),
        types: eip712Types,
        primaryType: "Attestation",
        message: attestation,
      });

      setStage("submitting");
      const txHash = await writeContract({
        address: info.escrowAddress,
        abi: escrowAbi,
        functionName: "countersign",
        args: [secret, attestation, signature],
      });
      const countersignReceipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });
      if (countersignReceipt.status !== "success") {
        throw new Error("Countersign reverted on-chain");
      }

      // Retry to ride out RPC node propagation lag between the receipt and
      // the immediate read on a multi-node provider.
      let attestationStructHash!: `0x${string}`;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          attestationStructHash = (await publicClient.readContract({
            address: info.escrowAddress,
            abi: escrowAbi,
            functionName: "hashAttestation",
            args: [attestation],
          })) as `0x${string}`;
          break;
        } catch (err) {
          if (attempt === 2) throw err;
          await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
        }
      }

      // Persist Party B's countersign to the off-chain index. State moves
      // Awaiting → Active here; partyBWallet now resolves on the dashboard.
      // Retry through transient failures (network blip, 5xx, server RPC
      // briefly a block behind the wallet's RPC) so a momentary glitch
      // doesn't leave the DB un-synced and Party A stuck on "waiting for
      // countersign" until the next read-time self-heal.
      await postCountersignWithRetry(info.escrowAddress, {
        wallet,
        name: profile.name,
        email: profile.email,
        attestationHash: attestationStructHash,
      });

      // Stamp B's Quick Sign block onto the existing signed PDF (which
      // carries A's block) and re-pin. On-chain pdfHash is unchanged -
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
          const stampedFile = new File(
            [new Blob([stamped as BlobPart], { type: "application/pdf" })],
            "contract-signed.pdf",
            { type: "application/pdf" },
          );

          // Store the bytes first — the next read (receipt page, dashboard)
          // serves from this blob without needing IPFS to settle.
          const blobFd = new FormData();
          blobFd.append("file", stampedFile);
          await fetch(
            `/api/contracts/${info.escrowAddress}/blob?signed=1`,
            { method: "POST", body: blobFd },
          ).catch((err) =>
            console.error("Signed PDF blob upload failed", err),
          );

          const fd = new FormData();
          fd.append("file", stampedFile);
          const pin = await fetch("/api/ipfs", { method: "POST", body: fd });
          if (pin.ok) {
            const { cid: signedCid } = (await pin.json()) as { cid: string };
            const signedRes = await fetch(
              `/api/contracts/${info.escrowAddress}/signed`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ signedPdfCid: signedCid }),
              },
            );
            if (!signedRes.ok) {
              console.error("Signed PDF index update failed", {
                escrowAddress: info.escrowAddress,
                status: signedRes.status,
                statusText: signedRes.statusText,
                signedCid,
              });
            }
          } else {
            console.error("IPFS pin failed for stamped PDF", {
              escrowAddress: info.escrowAddress,
              status: pin.status,
              statusText: pin.statusText,
            });
          }
        }
      } catch (err) {
        console.error("Stamped PDF best-effort path failed", err);
        // Non-fatal: the on-chain commitment is what matters; the
        // stamped artifact is best-effort.
      }

      onDone();
    } catch (err) {
      console.error("Party B sign-and-deposit flow failed", err);
      setError(
        showRawErrors
          ? err instanceof Error
            ? err.message
            : "Something went wrong"
          : "An error occurred.",
      );
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
              {selectedToken.symbol}
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
              inputMode="decimal"
              value={confirm}
              onChange={(e) =>
                setConfirm(
                  sanitizeDecimalInput(e.target.value, selectedToken.decimals),
                )
              }
              placeholder={exactAmount}
              className="flex-1 bg-transparent text-paper outline-none placeholder:text-ink-faint"
            />
            <span className="inline-flex items-center gap-1 text-ink-muted" style={{ fontSize: 11 }}>
              {confirmMatches ? (
                <>
                  matches
                  <Check size={12} strokeWidth={2.5} />
                </>
              ) : (
                `must equal ${exactAmount}`
              )}
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
            v={`${info.depositAmount} ${selectedToken.symbol}`}
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
          tokenAddress={info.depositToken}
          symbol={selectedToken.symbol}
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
            {stage === "idle" && "Sign & deposit · one transaction"}
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
        <ArrowRight size={16} />
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
        <CornerDownRight size={11} className="inline-block mr-1 align-text-bottom" />
        Funds release only when both you and{" "}
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

type PartyBPayload = {
  wallet: `0x${string}`;
  name: string;
  email: string;
  attestationHash: `0x${string}`;
};

/// POST the countersign index update with backoff. The server already polls
/// for on-chain state propagation, but the network round-trip itself can
/// drop (mobile flake, ad-blocker, server cold-start) - and Party A's view
/// is gated on this row update. The read-time self-heal in
/// `/api/contracts/[address]` covers a permanent drop, but retrying here
/// closes the window during which Party A would still see stale state.
async function postCountersignWithRetry(
  escrowAddress: string,
  partyB: PartyBPayload,
): Promise<void> {
  const url = `/api/contracts/${escrowAddress}/countersign`;
  const body = JSON.stringify({ partyB });
  const MAX_ATTEMPTS = 4;
  let lastError = "Failed to save countersign";
  let lastStatus: number | null = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      });
      if (res.ok) return;

      lastStatus = res.status;
      let message = lastError;
      try {
        const payload = (await res.clone().json()) as { error?: unknown };
        if (typeof payload?.error === "string") message = payload.error;
      } catch {
        // Keep the generic fallback if the response isn't JSON.
      }
      lastError = message;

      // 5xx or a 409 on a stale-state read is transient. Other 4xx is a
      // semantic mismatch (wrong wallet, factory mismatch, schema fail) -
      // no point hammering the server.
      const transientStatus =
        res.status >= 500 ||
        (res.status === 409 && /not yet countersigned|escrow not deployed/i.test(message));
      if (!transientStatus || attempt === MAX_ATTEMPTS - 1) {
        console.error("Countersign index save failed", {
          escrowAddress,
          status: res.status,
          statusText: res.statusText,
          message,
          attempt: attempt + 1,
        });
        throw new Error(message);
      }
      console.warn("Countersign index save retrying", {
        escrowAddress,
        status: res.status,
        message,
        attempt: attempt + 1,
      });
    } catch (err) {
      // Network error (fetch threw) - treat as transient until we exhaust.
      if (err instanceof Error && err.message === lastError) throw err;
      if (attempt === MAX_ATTEMPTS - 1) {
        console.error("Countersign index save network error", {
          escrowAddress,
          attempt: attempt + 1,
          err,
        });
        throw err;
      }
      console.warn("Countersign index save network error, retrying", {
        escrowAddress,
        attempt: attempt + 1,
        err,
      });
    }
    await new Promise((r) => setTimeout(r, 600 * 2 ** attempt));
  }

  // Defensive: the loop's final-attempt branches all throw, but TS can't
  // narrow that without an exhaustiveness marker.
  throw new Error(`${lastError}${lastStatus ? ` (HTTP ${lastStatus})` : ""}`);
}
