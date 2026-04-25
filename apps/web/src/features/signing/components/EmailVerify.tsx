"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useEmailOtp } from "../hooks/useEmailOtp";

/// Self-contained email-verify widget. Owns the email input so parent forms
/// don't need to track a duplicate value that can drift out of sync with the
/// verified address. `onVerified` fires once with the address that was
/// actually verified — use that as the source of truth.
export function EmailVerify({
  initialEmail = "",
  onVerified,
}: {
  initialEmail?: string;
  onVerified: (email: string) => void;
}) {
  const otp = useEmailOtp();
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");

  if (otp.stage === "verified") {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-emerald-300">
        <Check size={14} strokeWidth={2.5} />
        {otp.email} verified
      </p>
    );
  }

  if (otp.stage === "sent" || otp.stage === "verifying") {
    return (
      <div className="space-y-2">
        <p className="text-xs text-zinc-500">
          Code sent to <strong>{otp.email}</strong>. Check your inbox.
        </p>
        <div className="flex gap-2">
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="123456"
            className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 tracking-widest"
          />
          <button
            type="button"
            disabled={code.length !== 6 || otp.stage === "verifying"}
            onClick={async () => {
              const ok = await otp.verify(code);
              if (ok) onVerified(otp.email);
            }}
            className="rounded-md bg-[color:var(--color-accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
          >
            {otp.stage === "verifying" ? "…" : "Verify"}
          </button>
        </div>
        {otp.error && <p className="text-xs text-red-400">{otp.error}</p>}
        <button
          type="button"
          className="text-xs text-zinc-500 underline"
          onClick={() => otp.reset()}
        >
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.co"
          className="flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2"
        />
        <button
          type="button"
          disabled={!email.includes("@") || otp.stage === "sending"}
          onClick={() => otp.request(email)}
          className="rounded-md bg-[color:var(--color-accent)] px-3 py-2 text-sm font-medium text-black disabled:opacity-50"
        >
          {otp.stage === "sending" ? "…" : "Send code"}
        </button>
      </div>
      {otp.error && <p className="text-xs text-red-400">{otp.error}</p>}
    </div>
  );
}
