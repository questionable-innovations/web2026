"use client";

import { useEffect, useState } from "react";
import { CornerDownRight } from "lucide-react";
import { useAccount } from "wagmi";
import { PageShell } from "@/components/AppShell";
import { EmailVerify } from "@/features/signing/components/EmailVerify";

type Profile = { wallet: string; name: string; email: string };

export default function SettingsPage() {
  return (
    <PageShell active="settings">
      <div className="px-9 py-8">
        <div className="mb-8">
          <div className="ds-eyebrow">Account · Settings</div>
          <h1
            className="mt-1.5 font-serif font-normal"
            style={{ fontSize: 44, lineHeight: 1.15, letterSpacing: -0.9 }}
          >
            Settings.
          </h1>
        </div>
        <Body />
      </div>
    </PageShell>
  );
}

function Body() {
  const { address, isConnected } = useAccount();

  if (!isConnected || !address) {
    return (
      <div className="border border-rule bg-card p-7">
        <p className="text-ink/70" style={{ fontSize: 14 }}>
          Sign in with your wallet to view your profile.
        </p>
      </div>
    );
  }

  return <Loaded wallet={address} />;
}

function Loaded({ wallet }: { wallet: `0x${string}` }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/profile?wallet=${wallet}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { profile: Profile | null } | null) => {
        if (cancelled) return;
        setProfile(d?.profile ?? null);
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet]);

  if (!loaded) {
    return (
      <p className="font-mono text-muted" style={{ fontSize: 12 }}>
        Loading…
      </p>
    );
  }

  return (
    <div className="grid gap-6" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
      <ProfileCard wallet={wallet} profile={profile} onSaved={setProfile} />
      <aside className="space-y-4">
        <div className="border border-rule bg-card p-6">
          <div className="ds-eyebrow mb-3">Wallet</div>
          <p
            className="font-mono"
            style={{ fontSize: 12, lineHeight: 1.6 }}
          >
            {wallet}
          </p>
          <p
            className="mt-3 text-ink/70"
            style={{ fontSize: 13, lineHeight: 1.5 }}
          >
            DealSeal uses your connected wallet for every signature and deposit.
            Disconnect from your wallet provider to switch.
          </p>
        </div>
        <div
          className="bg-paper p-4 font-mono text-muted"
          style={{
            fontSize: 11,
            lineHeight: 1.6,
            border: "1px solid var(--color-rule)",
          }}
        >
          <CornerDownRight size={11} className="inline-block mr-1 align-text-bottom" />
          Your profile is stored once per wallet. Every contract you sign
          reuses these values; no more retyping.
        </div>
      </aside>
    </div>
  );
}

function ProfileCard({
  wallet,
  profile,
  onSaved,
}: {
  wallet: `0x${string}`;
  profile: Profile | null;
  onSaved: (p: Profile) => void;
}) {
  const [editing, setEditing] = useState(profile === null);
  const [name, setName] = useState(profile?.name ?? "");
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const emailToSave = verifiedEmail ?? profile?.email ?? null;
  const ready =
    name.trim().length > 0 &&
    emailToSave !== null &&
    (name.trim() !== profile?.name || verifiedEmail !== null);

  async function save() {
    if (!ready || !emailToSave) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, name: name.trim(), email: emailToSave }),
      });
      if (!res.ok) throw new Error("save failed");
      const { profile: saved } = (await res.json()) as { profile: Profile };
      onSaved(saved);
      setVerifiedEmail(null);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing && profile) {
    return (
      <div className="border border-rule bg-card p-7">
        <div className="mb-3 flex items-baseline justify-between">
          <div className="ds-eyebrow">Profile</div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-accent"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            EDIT
          </button>
        </div>
        <Stub label="Display name" value={profile.name} />
        <Stub label="Verified email" value={profile.email} />
      </div>
    );
  }

  return (
    <div className="border border-rule bg-card p-7">
      <div className="ds-eyebrow mb-3">
        {profile ? "Edit profile" : "Set up your profile"}
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
        Your email{" "}
        {profile ? (
          <span className="text-muted/70">
            (re-verify only if changing; currently <strong>{profile.email}</strong>)
          </span>
        ) : (
          "(verified)"
        )}
      </div>
      <EmailVerify
        initialEmail={profile?.email ?? ""}
        onVerified={setVerifiedEmail}
      />

      <div className="mt-7 flex justify-between border-t border-rule-soft pt-6">
        {profile ? (
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(profile.name);
              setVerifiedEmail(null);
              setError(null);
            }}
            className="border border-rule px-4 py-3 text-[13px]"
          >
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          disabled={!ready || saving}
          onClick={save}
          className="bg-ink px-5 py-3 text-[13px] text-paper disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
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
  );
}

function Stub({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between border-b border-rule-soft py-3 last:border-0"
      style={{ fontSize: 13 }}
    >
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
