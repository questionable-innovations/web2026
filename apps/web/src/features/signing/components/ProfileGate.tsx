"use client";

import { ReactNode, useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { EmailVerify } from "./EmailVerify";

export type Profile = {
  wallet: `0x${string}`;
  name: string;
  email: string;
};

/// Profile-level gate that fires once per wallet, immediately after sign-in.
/// Captures the legal name + verified email that get committed (as salted
/// hashes) on every contract this wallet ever signs. Persisted server-side
/// keyed by wallet so subsequent contracts skip this step entirely.
export function ProfileGate({
  wallet,
  children,
}: {
  wallet: `0x${string}`;
  children: (profile: Profile) => ReactNode;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile?wallet=${wallet}`)
      .then((r) =>
        r.ok ? r.json() : Promise.reject(new Error("lookup failed")),
      )
      .then((d: { profile: Profile | null }) => {
        if (cancelled) return;
        setProfile(d.profile);
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setLoadError(err.message);
          setLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (!loaded) {
    return (
      <div className="border border-rule bg-card p-9">
        <p className="font-mono text-muted" style={{ fontSize: 12 }}>
          Looking up your profile…
        </p>
      </div>
    );
  }

  if (profile) return <>{children(profile)}</>;

  return (
    <Onboarding
      wallet={wallet}
      onError={setLoadError}
      onSaved={(p) => setProfile(p)}
      error={loadError}
    />
  );
}

function Onboarding({
  wallet,
  onSaved,
  onError,
  error,
}: {
  wallet: `0x${string}`;
  onSaved: (p: Profile) => void;
  onError: (msg: string | null) => void;
  error: string | null;
}) {
  const [name, setName] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const ready = name.trim().length > 0 && verifiedEmail !== null;

  async function save() {
    if (!ready) return;
    onError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet,
          name: name.trim(),
          email: verifiedEmail,
        }),
      });
      if (!res.ok) throw new Error("save failed");
      const { profile } = (await res.json()) as { profile: Profile };
      onSaved(profile);
    } catch (err) {
      console.error("Profile save failed", err);
      onError(err instanceof Error ? err.message : "save failed");
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <div className="border border-rule bg-card p-9">
        <div className="ds-eyebrow mb-2">Step 0 · Set up your identity</div>
        <h2
          className="font-serif font-normal"
          style={{ fontSize: 38, lineHeight: 1.1, letterSpacing: -0.7 }}
        >
          Let&apos;s get your details, once.
        </h2>
        <p
          className="mt-3 max-w-md leading-relaxed text-ink/70"
          style={{ fontSize: 15 }}
        >
          Your name + verified email are committed as <em>salted hashes</em>{" "}
          on every contract this wallet signs. We&apos;ll capture them now so
          you never have to re-enter them.
        </p>

        <div className="mt-7">
          <div
            className="mb-4 bg-paper px-3 py-2.5 font-mono"
            style={{
              fontSize: 11,
              border: "1px solid var(--color-rule)",
              lineHeight: 1.6,
            }}
          >
            <div className="text-muted">Wallet (signed in)</div>
            <div>{wallet}</div>
          </div>

          <div className="mb-1.5 text-muted" style={{ fontSize: 11 }}>
            Your full name
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aroha @ QInnovate"
            className="ds-input"
          />

          <div style={{ height: 14 }} />
          <div className="mb-1.5 text-muted" style={{ fontSize: 11 }}>
            Your email (verified)
          </div>
          <EmailVerify onVerified={setVerifiedEmail} />

          <p
            className="mt-3 font-mono text-muted"
            style={{ fontSize: 10, lineHeight: 1.5 }}
          >
            Plaintext stays in our DB. Only revealed in a dispute (CCLA s.229).
          </p>
        </div>

        <div className="mt-7 flex items-center justify-between border-t border-rule-soft pt-6">
          <span
            className="font-mono text-muted"
            style={{ fontSize: 11 }}
          >
            Update later in Settings.
          </span>
          <button
            type="button"
            disabled={!ready || saving}
            onClick={save}
            className="inline-flex items-center gap-2 bg-ink px-5 py-3 text-[13px] text-paper disabled:opacity-50"
          >
            {saving ? (
              "Saving…"
            ) : (
              <>
                Save & continue
                <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>

        {error && (
          <p
            className="mt-3 font-mono text-accent"
            style={{ fontSize: 11 }}
          >
            {error}
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Why now?</div>
          <ul
            className="list-disc pl-5 leading-relaxed text-ink/75"
            style={{ fontSize: 14 }}
          >
            <li>One-time setup; every future contract reuses this.</li>
            <li>Your email proves identity in disputes; your wallet proves intent.</li>
            <li>Edit any time from <strong>Settings</strong>.</li>
          </ul>
        </div>
        <div className="bg-ink p-5 text-paper">
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: 1,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            What&apos;s committed on-chain
          </div>
          <div
            className="mt-2 font-mono"
            style={{ fontSize: 11, lineHeight: 1.7 }}
          >
            <div>nameHash &nbsp;&nbsp;&nbsp; keccak(name + salt)</div>
            <div>emailHash &nbsp;&nbsp; keccak(email + salt)</div>
            <div>wallet &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; you</div>
            <div>plaintext &nbsp;&nbsp; off-chain only</div>
          </div>
        </div>
      </div>
    </div>
  );
}
