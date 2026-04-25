# DealSeal

DocuSign for web3. Signing *is* paying a deposit into a smart-contract escrow.
Built for the Web3 NZ 2026 hackathon. See `project.md` for the full design.

## Layout

```
.
├── apps/web/          Next.js 15 app (App Router, Tailwind v4, wagmi + Privy)
├── contracts/         Foundry workspace (Escrow + EscrowFactory + ReputationView)
├── Dockerfile         Production image (Caprover-compatible, repo-root context)
├── captain-definition Caprover entrypoint
├── docker-compose.yml web + optional anvil dev profile
└── project.md         Design doc (decisions live here)
```

## Prerequisites

- Node 22+ and pnpm 10+ (`corepack enable`)
- Foundry (`brew install foundry`) for smart contract work
- Docker (for `docker compose up` or Caprover deploys)

## Quick start

```bash
cp .env.example .env       # fill in PRIVY_APP_ID, PINATA_JWT, etc.
pnpm install
pnpm dev                   # web app on http://localhost:3000
```

### Smart contracts

```bash
cd contracts
forge test
forge script script/Deploy.s.sol --rpc-url fuji --broadcast
```

To publish verified source code on Snowtrace when deploying to Fuji, set these
in `.env` at the repo root:

```bash
DEPLOYER_PRIVATE_KEY=0x...
SNOWTRACE_API_KEY=...
NEXT_PUBLIC_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

Then deploy:

```bash
pnpm contracts:deploy:fuji       # Git Bash / WSL
pnpm contracts:deploy:fuji:win   # PowerShell on Windows
```

The deploy script prints the `Escrow impl` and `EscrowFactory` addresses —
put the factory into `NEXT_PUBLIC_ESCROW_FACTORY` in `.env` and restart the
web app.

### Local chain for dev

```bash
docker compose --profile dev up anvil
# RPC at http://localhost:8545, chain id 31337
```

## Architecture notes

- **Clones (EIP-1167).** Every deal is a minimal-proxy clone of one immutable
  `Escrow` implementation — ~45k gas per deal vs ~1.5M for full deploys.
- **URL-secret gating.** Party A generates a 32-byte secret at create time;
  only `keccak256(secret)` lives on-chain. The share link is
  `…/c/<escrow>#<secret>` — the secret stays in the URL fragment, never sent
  to the server. Counter-signing requires the preimage.
- **EIP-712 attestations** with salted name/email hashes pin
  `(wallet, name, email, pdfHash, nonce, deadline)` against the chain.
- **Pull payment + balance-delta check** on every transfer; `ReentrancyGuard`
  + CEI ordering on every state-changing function.
- **`rescue()`** is the long-horizon escape hatch (≥365 days past deadline)
  for the "token blacklist / pause" failure mode.

## Tech (locked in §9 of project.md)

| Layer       | Choice                                       |
| ----------- | -------------------------------------------- |
| Frontend    | Next.js 15 + React 19 + Tailwind v4          |
| Wallet      | Privy embedded + wagmi connectors            |
| PDF         | `react-pdf` + `react-signature-canvas`       |
| DB          | SQLite via Drizzle (off-chain index only)    |
| Storage     | IPFS via Pinata                              |
| Chain       | Avalanche Fuji (MVP), C-chain (prod)         |
| Stablecoin  | dNZD (fallback USDC)                         |
| Contracts   | Foundry (Solidity 0.8.27, via_ir)            |

## Scripts

- `pnpm dev` — Next.js dev server (Turbopack)
- `pnpm build` — production build
- `pnpm typecheck` — TS check across workspace
- `pnpm contracts:test` — Foundry tests
- `pnpm contracts:build` — compile Solidity
