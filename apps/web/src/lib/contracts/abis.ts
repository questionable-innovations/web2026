// Hand-maintained until `contracts:build` is wired to emit typed ABIs.
// Keep in sync with /contracts/src/*.sol.

export const escrowAbi = [
  {
    type: "function",
    name: "countersign",
    stateMutability: "nonpayable",
    inputs: [
      { name: "secret", type: "bytes32" },
      {
        name: "partyBAttestation",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "nameHash", type: "bytes32" },
          { name: "emailHash", type: "bytes32" },
          { name: "pdfHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "partyBSignature", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "proposeRelease",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "approveRelease",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "flagDispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "reason", type: "string" }],
    outputs: [],
  },
  {
    type: "function",
    name: "rescue",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "state",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "amount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "validUntil",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint64" }],
  },
] as const;

export const escrowFactoryAbi = [
  {
    type: "function",
    name: "createEscrow",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "pdfHash", type: "bytes32" },
      { name: "pdfCid", type: "string" },
      { name: "dealDeadline", type: "uint64" },
      { name: "validUntil", type: "uint64" },
      { name: "secretHash", type: "bytes32" },
      {
        name: "partyAAttestation",
        type: "tuple",
        components: [
          { name: "wallet", type: "address" },
          { name: "nameHash", type: "bytes32" },
          { name: "emailHash", type: "bytes32" },
          { name: "pdfHash", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      { name: "partyASignature", type: "bytes" },
    ],
    outputs: [{ name: "escrow", type: "address" }],
  },
  {
    type: "event",
    name: "EscrowCreated",
    inputs: [
      { name: "escrow", type: "address", indexed: true },
      { name: "partyA", type: "address", indexed: true },
      { name: "token", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

/// EIP-712 typed-data shape for `signTypedData_v4`.
export const attestationTypes = {
  Attestation: [
    { name: "wallet", type: "address" },
    { name: "nameHash", type: "bytes32" },
    { name: "emailHash", type: "bytes32" },
    { name: "pdfHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export const eip712Domain = {
  name: "DealSeal",
  version: "1",
} as const;
