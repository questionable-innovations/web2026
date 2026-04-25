import { keccak256, toHex, encodeAbiParameters, toBytes } from "viem";

/// Salted hash of `(value, salt)` so off-chain leak of a name/email
/// doesn't enable a rainbow lookup against the chain (§4.2).
export function saltedHash(value: string, salt: `0x${string}`): `0x${string}` {
  return keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "bytes" }],
      [salt, toHex(toBytes(value.normalize("NFC")))],
    ),
  );
}

export function newSalt(): `0x${string}` {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export type Attestation = {
  wallet: `0x${string}`;
  nameHash: `0x${string}`;
  emailHash: `0x${string}`;
  pdfHash: `0x${string}`;
  nonce: bigint;
  deadline: bigint;
};

export type AttestationInput = {
  wallet: `0x${string}`;
  name: string;
  email: string;
  nameSalt: `0x${string}`;
  emailSalt: `0x${string}`;
  pdfHash: `0x${string}`;
  /// On-chain `nonces[signer]` - 0 for first sign by that wallet on that escrow.
  nonce?: bigint;
  /// Unix seconds. Sig is rejected after this (defense-in-depth).
  deadlineSecs?: bigint;
};

export function buildAttestation(input: AttestationInput): Attestation {
  return {
    wallet: input.wallet,
    nameHash: saltedHash(input.name, input.nameSalt),
    emailHash: saltedHash(input.email, input.emailSalt),
    pdfHash: input.pdfHash,
    nonce: input.nonce ?? 0n,
    deadline: input.deadlineSecs ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
  };
}

export const eip712Types = {
  Attestation: [
    { name: "wallet", type: "address" },
    { name: "nameHash", type: "bytes32" },
    { name: "emailHash", type: "bytes32" },
    { name: "pdfHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export function eip712Domain(chainId: number, escrow: `0x${string}`) {
  return {
    name: "DealSeal",
    version: "1",
    chainId,
    verifyingContract: escrow,
  } as const;
}
