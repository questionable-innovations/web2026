"use client";

import { useEffect, useState } from "react";

export function shortAddress(address: string | null | undefined): string {
  if (!address) return "—";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/// Pick the best label for an address: a profile display name beats ENS, ENS
/// beats a truncated 0x. The ladder is intentional — profile names are the
/// only string the user explicitly typed for *this* app, ENS is portable
/// identity from elsewhere, the short address is the floor.
export function pickAddressLabel(opts: {
  profileName?: string | null;
  ensName?: string | null;
  address?: string | null;
}): string {
  return (
    opts.profileName ??
    opts.ensName ??
    shortAddress(opts.address)
  );
}

const inflight = new Map<string, Promise<string | null>>();
const seen = new Map<string, string | null>();

async function fetchEnsName(address: string): Promise<string | null> {
  const key = address.toLowerCase();
  if (seen.has(key)) return seen.get(key) ?? null;
  let pending = inflight.get(key);
  if (!pending) {
    pending = fetch(`/api/ens?address=${key}`)
      .then(async (r) => (r.ok ? ((await r.json()).ensName as string | null) : null))
      .catch(() => null)
      .then((value) => {
        seen.set(key, value);
        inflight.delete(key);
        return value;
      });
    inflight.set(key, pending);
  }
  return pending;
}

/// Reverse-resolve an address to its ENS primary name. Returns null while
/// loading or when the address has no primary name set. Multiple components
/// asking about the same address share one in-flight request and one cache
/// entry, so a list of N rows still costs N (not N²) requests.
export function useEnsName(address: string | null | undefined): string | null {
  const [name, setName] = useState<string | null>(() => {
    if (!address) return null;
    return seen.get(address.toLowerCase()) ?? null;
  });

  useEffect(() => {
    if (!address) {
      setName(null);
      return;
    }
    let cancelled = false;
    fetchEnsName(address).then((v) => {
      if (!cancelled) setName(v);
    });
    return () => {
      cancelled = true;
    };
  }, [address]);

  return name;
}
