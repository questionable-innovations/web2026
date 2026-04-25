import { keccak256, toHex } from "viem";

/// Generate a 32-byte URL secret. Goes in the URL fragment (`#<secret>`)
/// and is never sent to the server.
export function newSecret(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export function secretHash(secret: `0x${string}`): `0x${string}` {
  return keccak256(secret);
}

export function shareLink(escrow: string, secret: `0x${string}`): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/c/${escrow}#${secret.slice(2)}`;
}

/// Read a secret from `window.location.hash`. Client-side only.
export function readSecretFromHash(): `0x${string}` | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(hash)) return null;
  return `0x${hash}`;
}
