import { createPublicClient, http, isAddress } from "viem";
import { normalize } from "viem/ens";
import { mainnet } from "viem/chains";

/// ENS resolution lives on Ethereum mainnet, not Avalanche. We deploy escrows
/// on Avalanche (where ENS doesn't exist), but resolve names against mainnet
/// purely for display + reputation indexing. The on-chain trust model stays
/// address-based; ENS is a UX layer only.
const mainnetRpc =
  process.env.ENS_MAINNET_RPC ?? process.env.NEXT_PUBLIC_ENS_MAINNET_RPC;

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(mainnetRpc),
});

const ENS_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function looksLikeEnsName(input: string): boolean {
  const trimmed = input.trim();
  return !isAddress(trimmed) && ENS_NAME.test(trimmed);
}

type CacheEntry<T> = { value: T; expiresAt: number };

const REVERSE_TTL_MS = 60 * 60 * 1000;
const FORWARD_TTL_MS = 5 * 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 60 * 1000;

const reverseCache = new Map<string, CacheEntry<string | null>>();
const forwardCache = new Map<string, CacheEntry<`0x${string}` | null>>();

function readCache<T>(map: Map<string, CacheEntry<T>>, key: string): T | undefined {
  const hit = map.get(key);
  if (!hit) return undefined;
  if (hit.expiresAt < Date.now()) {
    map.delete(key);
    return undefined;
  }
  return hit.value;
}

function writeCache<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/// Reverse-resolve a wallet address to its primary ENS name (e.g. `vitalik.eth`).
/// Returns null when the address has no primary name set on mainnet, or if the
/// mainnet RPC is unreachable - display code should fall back to a shortened
/// address. We deliberately swallow RPC errors so a flaky mainnet endpoint
/// can't break the reputation page.
export async function reverseResolve(
  address: `0x${string}`,
): Promise<string | null> {
  const key = address.toLowerCase();
  const cached = readCache(reverseCache, key);
  if (cached !== undefined) return cached;

  try {
    const name = await ensClient.getEnsName({ address });
    writeCache(
      reverseCache,
      key,
      name ?? null,
      name ? REVERSE_TTL_MS : NEGATIVE_TTL_MS,
    );
    return name ?? null;
  } catch {
    writeCache(reverseCache, key, null, NEGATIVE_TTL_MS);
    return null;
  }
}

/// Forward-resolve an ENS name (e.g. `dealseal.eth`) to a wallet address.
/// Used for the lookup form and `/b/<name>` URL aliasing. Returns null on
/// invalid name, no resolver, or RPC error.
export async function forwardResolve(
  name: string,
): Promise<`0x${string}` | null> {
  let normalized: string;
  try {
    normalized = normalize(name.trim());
  } catch {
    return null;
  }

  const cached = readCache(forwardCache, normalized);
  if (cached !== undefined) return cached;

  try {
    const address = await ensClient.getEnsAddress({ name: normalized });
    writeCache(
      forwardCache,
      normalized,
      address ?? null,
      address ? FORWARD_TTL_MS : NEGATIVE_TTL_MS,
    );
    return address ?? null;
  } catch {
    writeCache(forwardCache, normalized, null, NEGATIVE_TTL_MS);
    return null;
  }
}

/// Resolve many addresses at once for list views. Concurrent but bounded -
/// mainnet RPCs throttle aggressive callers. Order matches input.
export async function reverseResolveMany(
  addresses: readonly `0x${string}`[],
): Promise<(string | null)[]> {
  return Promise.all(addresses.map((a) => reverseResolve(a)));
}

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

const PROFILE_TTL_MS = 30 * 60 * 1000;
const profileCache = new Map<string, CacheEntry<EnsProfile | null>>();

const TEXT_KEYS = [
  "description",
  "url",
  "com.twitter",
  "com.github",
  "email",
] as const;

/// Resolve an ENS name to its full profile: address + avatar + selected text
/// records. We fetch records in parallel and tolerate per-record failures -
/// missing records are common (most names only set a couple), so we never
/// fail the whole call when one lookup throws. Avatar resolution uses viem's
/// helper which already handles `eip155:` NFT URIs and IPFS gateways.
export async function resolveEnsProfile(name: string): Promise<EnsProfile | null> {
  let normalized: string;
  try {
    normalized = normalize(name.trim());
  } catch {
    return null;
  }

  const cached = readCache(profileCache, normalized);
  if (cached !== undefined) return cached;

  try {
    const address = await ensClient.getEnsAddress({ name: normalized });
    if (!address) {
      writeCache(profileCache, normalized, null, NEGATIVE_TTL_MS);
      return null;
    }

    const settled = await Promise.allSettled([
      ensClient.getEnsAvatar({ name: normalized }).catch(() => null),
      ...TEXT_KEYS.map((key) =>
        ensClient.getEnsText({ name: normalized, key }).catch(() => null),
      ),
    ]);

    const [avatarRes, descRes, urlRes, twRes, ghRes, emailRes] = settled;
    const pick = (r: PromiseSettledResult<string | null | undefined>) =>
      r.status === "fulfilled" && r.value ? r.value : null;

    const profile: EnsProfile = {
      name: normalized,
      address,
      avatar: pick(avatarRes),
      description: pick(descRes),
      url: pick(urlRes),
      twitter: pick(twRes),
      github: pick(ghRes),
      email: pick(emailRes),
    };
    writeCache(profileCache, normalized, profile, PROFILE_TTL_MS);
    return profile;
  } catch {
    writeCache(profileCache, normalized, null, NEGATIVE_TTL_MS);
    return null;
  }
}
