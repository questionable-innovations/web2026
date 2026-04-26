const DEFAULT_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export class IpfsFetchError extends Error {
  readonly attempts: string[];

  constructor(message: string, attempts: string[]) {
    super(message);
    this.attempts = attempts;
  }
}

export async function fetchPdfFromCid(cid: string): Promise<Uint8Array> {
  const attempts: string[] = [];

  for (const url of gatewayUrls(cid)) {
    attempts.push(url);
    try {
      const res = await fetchWithTimeout(url, 15_000);
      if (!res.ok) continue;

      const bytes = new Uint8Array(await res.arrayBuffer());
      if (looksLikePdf(bytes)) return bytes;
    } catch {
      // Try the next gateway candidate.
    }
  }

  throw new IpfsFetchError("ipfs pdf fetch failed", attempts);
}

function gatewayUrls(cid: string): string[] {
  const configured = process.env.NEXT_PUBLIC_IPFS_GATEWAY;
  const candidates = configured
    ? [...urlsForGateway(configured, cid), ...DEFAULT_GATEWAYS.map((g) => `${g}${cid}`)]
    : DEFAULT_GATEWAYS.map((g) => `${g}${cid}`);

  return [...new Set(candidates)];
}

function urlsForGateway(gateway: string, cid: string): string[] {
  const normalized = normalizeGateway(gateway);
  const url = new URL(normalized);
  const pathname = url.pathname.replace(/\/+$/, "");

  if (pathname.endsWith("/ipfs") || pathname.endsWith("/files")) {
    return [`${normalized}${cid}`];
  }

  return [`${normalized}ipfs/${cid}`, `${normalized}files/${cid}`, `${normalized}${cid}`];
}

function normalizeGateway(gateway: string): string {
  const withProtocol = /^https?:\/\//i.test(gateway)
    ? gateway
    : `https://${gateway}`;
  return withProtocol.endsWith("/") ? withProtocol : `${withProtocol}/`;
}

function looksLikePdf(bytes: Uint8Array): boolean {
  const header = new TextDecoder()
    .decode(bytes.slice(0, Math.min(bytes.length, 1024)))
    .trimStart();
  return header.startsWith("%PDF-");
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}
