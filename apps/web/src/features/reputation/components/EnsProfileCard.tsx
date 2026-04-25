"use client";

import { shortAddress } from "@/lib/ens-client";

export type EnsProfile = {
  name: string;
  address: `0x${string}` | null;
  avatar: string | null;
  description: string | null;
  url: string | null;
  twitter: string | null;
  github: string | null;
  email: string | null;
};

/// Visual card for an ENS profile. Used both in the lookup explorer (live
/// preview as you type) and on the per-wallet reputation page (sidebar). All
/// fields are optional — most ENS names only set a couple of records, so the
/// component degrades quietly when fields are missing.
export function EnsProfileCard({
  profile,
  variant = "default",
}: {
  profile: EnsProfile;
  variant?: "default" | "compact";
}) {
  const compact = variant === "compact";
  return (
    <div className="border border-rule bg-card">
      <div
        className="border-b border-rule px-5 py-3 font-mono uppercase text-muted"
        style={{ fontSize: 10, letterSpacing: 1.5 }}
      >
        ENS profile · mainnet
      </div>
      <div
        className="grid items-start gap-4 px-5 py-4"
        style={{ gridTemplateColumns: compact ? "48px 1fr" : "64px 1fr" }}
      >
        <Avatar src={profile.avatar} name={profile.name} size={compact ? 48 : 64} />
        <div className="min-w-0">
          <div
            className="font-serif text-ink"
            style={{ fontSize: compact ? 22 : 28, lineHeight: 1.05 }}
          >
            {profile.name}
          </div>
          {profile.address && (
            <div
              className="mt-1 font-mono text-muted"
              style={{ fontSize: 11, letterSpacing: 0.4 }}
              title={profile.address}
            >
              {shortAddress(profile.address)}
            </div>
          )}
          {profile.description && (
            <p
              className="mt-3 leading-snug text-ink/85"
              style={{ fontSize: 13 }}
            >
              {profile.description}
            </p>
          )}
          {(profile.url ||
            profile.twitter ||
            profile.github ||
            profile.email) && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {profile.url && (
                <ProfileLink
                  href={normalizeUrl(profile.url)}
                  label={profile.url.replace(/^https?:\/\//, "")}
                  kind="URL"
                />
              )}
              {profile.twitter && (
                <ProfileLink
                  href={`https://twitter.com/${stripAt(profile.twitter)}`}
                  label={`@${stripAt(profile.twitter)}`}
                  kind="X"
                />
              )}
              {profile.github && (
                <ProfileLink
                  href={`https://github.com/${stripAt(profile.github)}`}
                  label={stripAt(profile.github)}
                  kind="GH"
                />
              )}
              {profile.email && (
                <ProfileLink
                  href={`mailto:${profile.email}`}
                  label={profile.email}
                  kind="MAIL"
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({
  src,
  name,
  size,
}: {
  src: string | null;
  name: string;
  size: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} avatar`}
        width={size}
        height={size}
        className="object-cover"
        style={{
          width: size,
          height: size,
          background: "var(--color-paper)",
          border: "1px solid var(--color-rule)",
        }}
      />
    );
  }
  const initial = name.replace(/^0x/, "").charAt(0).toUpperCase();
  return (
    <div
      className="flex items-center justify-center font-serif text-paper"
      style={{
        width: size,
        height: size,
        background: "linear-gradient(135deg, #2a2a2a, #0a0a0a)",
        fontSize: Math.round(size * 0.45),
        lineHeight: 1,
      }}
      aria-hidden
    >
      {initial}
    </div>
  );
}

function ProfileLink({
  href,
  label,
  kind,
}: {
  href: string;
  label: string;
  kind: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-baseline gap-1.5 text-ink hover:text-accent"
      style={{ fontSize: 12 }}
    >
      <span
        className="font-mono uppercase text-muted"
        style={{ fontSize: 9, letterSpacing: 1 }}
      >
        {kind}
      </span>
      <span className="truncate" style={{ maxWidth: 200 }}>
        {label}
      </span>
    </a>
  );
}

function stripAt(s: string): string {
  return s.replace(/^@/, "");
}

function normalizeUrl(s: string): string {
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}
