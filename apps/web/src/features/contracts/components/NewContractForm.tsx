"use client";

import { useState } from "react";
import { sha256 } from "@/lib/ipfs";

type Stage = "idle" | "hashing" | "uploading" | "creating" | "done" | "error";

export function NewContractForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [counterparty, setCounterparty] = useState("");
  const [amount, setAmount] = useState("");
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string>();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError(undefined);
    try {
      setStage("hashing");
      const buf = await file.arrayBuffer();
      const hash = await sha256(buf);

      setStage("uploading");
      const fd = new FormData();
      fd.append("file", file);
      const upload = await fetch("/api/ipfs", { method: "POST", body: fd });
      if (!upload.ok) throw new Error("IPFS upload failed");
      const { cid } = (await upload.json()) as { cid: string };

      setStage("creating");
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          counterpartyEmail: counterparty,
          amount,
          pdfHash: hash,
          pdfCid: cid,
        }),
      });
      if (!res.ok) throw new Error("Create failed");
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStage("error");
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <Field label="Title">
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
          placeholder="Engagement letter — Acme Co"
        />
      </Field>
      <Field label="Counterparty email">
        <input
          required
          type="email"
          value={counterparty}
          onChange={(e) => setCounterparty(e.target.value)}
          className="input"
          placeholder="them@acme.co"
        />
      </Field>
      <Field label="Deposit amount (dNZD)">
        <input
          required
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="input"
          placeholder="2500"
        />
      </Field>
      <Field label="PDF">
        <input
          required
          type="file"
          accept="application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="input"
        />
      </Field>

      <button
        type="submit"
        disabled={stage !== "idle" && stage !== "error"}
        className="rounded-md bg-[color:var(--color-accent)] px-5 py-3 font-medium text-black disabled:opacity-50"
      >
        {stage === "idle" || stage === "error" ? "Create & sign first" : stage}
      </button>
      {error && <p className="text-sm text-red-400">{error}</p>}

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
