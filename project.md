# DealSeal

DocuSign for web3: a PDF signing flow where signing *is* paying a deposit into a smart-contract escrow, and both actions produce a single cryptographic commitment on Avalanche. Built for the **Web3 NZ 2026 hackathon**.

---

## 1. Core concept (as given)

- Party A (contractor / startup / supplier) uploads a PDF.
- Party A signs first. The PDF hash + metadata are written to a master contract on Avalanche.
- A share link is generated for Party B (the counterparty / client).
- Party B signs and deposits the agreed amount into a per-contract escrow.
- On successful completion, the original signing wallets vote/approve to release funds to the payee.
- If they disagree, funds sit in escrow until they do.
- Over time, wallets accumulate a visible execution history → on-chain reputation.

---

## 2. Why this is interesting

- **Signing and paying are a single atomic act.** Today these are two forms, two systems, two legal risks. Collapsing them removes "I signed but never paid" and "I paid but never received a signed doc."
- **Escrow replaces trust.** Especially relevant for cross-border work, early-stage startup → enterprise deals, and freelance engagements where the contractor is the smaller party.
- **Reputation is portable.** An NZ contractor can carry their execution record to a new client / platform / country without relying on LinkedIn recommendations.
- **Hackathon fit.** The pitch ("DocuSign, but the signature *is* the money") is clear in 10 seconds — that matters for judging.

---

## 3. Problems / risks with the concept as stated

### 3.1 Legal enforceability (the single biggest risk)

- Under NZ's **Contract and Commercial Law Act 2017** (which absorbed the Electronic Transactions Act 2002), an electronic signature is valid if it *adequately identifies the signatory and indicates their approval*. A wallet signature satisfies the cryptographic part but **not necessarily the identity part** — a wallet address is not a legal person.
- Without some identity binding (KYC, DID, verifiable credential, or even just an attested email), a court may not accept that `0xabc…` is Jane Doe.
- **Decision:** We *do* want to be a DocuSign equivalent. Each signer provides **name + email** at signing time, verified via email OTP. The tuple `(wallet, name, email, timestamp, pdfHash)` is hashed and committed on-chain; the plaintext attestation lives in the off-chain DB and is revealed on demand (e.g. in a dispute). This is sufficient for the electronic-signature requirement in most NZ commercial contexts and keeps PII off-chain.

### 3.2 "URL on-chain" is not tamper-proof

- You mentioned storing the hash *or* URL. Only the **hash** is meaningful — URLs rot and can be swapped.
- **Fix:** content-address the PDF. Upload to **IPFS (via Pinata/web3.storage)** or **Arweave** and store the CID. Anyone can fetch the bytes and verify the hash matches what's on-chain.
- Consider: encrypt the PDF before upload with a key derived from both signers' public keys, so the file content stays private even though its hash is public.

### 3.3 Deposit currency and volatility

- AVAX deposits mean a 3-month contract can see the NZD-equivalent drift 30%+. That's a dealbreaker for any real commercial use.
- **Decision:** denominate in **dNZD (New Money)** — NZD-pegged stablecoin, right audience fit for a NZ-focused product and a strong local angle for the Web3 NZ hackathon pitch. Contracts should reference the token by address (upgradeable via governance) rather than hardcoding, in case dNZD migrates or we add USDC later.
- **Verify before locking in:** dNZD's deployment on Avalanche C-chain (or bridge availability), audit status, and mint/redeem flow for demo-day funding. If dNZD isn't natively on Avalanche yet, that's a blocker — fall back to USDC and keep dNZD as the roadmap story.

### 3.4 Deadlock: "if they don't agree, the money sits there"

- **Position:** deadlock is the *feature*, not the bug. Money stuck in the middle removes either party's incentive to stonewall — neither gets it until they agree. This mirrors how commercial retention clauses work.
- **Where disputes get resolved: in the traditional legal system, not on-chain.** DealSeal is not an arbitration platform and will never adjudicate. The smart contract's job is to *keep the funds safe and produce admissible evidence*, full stop. If the parties disagree, they take their lawyers, the signed PDF, the audit certificate, and the on-chain history to mediation, the Disputes Tribunal, or the District Court — same as any other commercial dispute. The contract just refuses to release until both sides sign off (or a long-horizon `rescue()` path triggers).
- This framing keeps us out of the regulatory perimeter for arbitration/financial intermediation (§11.2) and out of the technical/social rabbit hole of building a fair on-chain jury.
- Still a real edge case worth hardening later. Known failure modes to keep noting:
  - One party genuinely disappears (death, business collapse, lost keys). Need a long-horizon escape hatch — this is what `rescue()` (§4.2) addresses, *not* dispute resolution.
  - Partial performance — work was 80% done, what's fair? Off-chain negotiation, then court. Not our problem to model.
  - Extortion in reverse (payee threatens reputational damage to force release). Reputation visibility is a feature; abuse via reputation is also resolvable through defamation / FTA channels.
- **For v1:** expose a `flagDispute()` that freezes the deal and records the disagreement on-chain (visible in reputation). Surface the audit certificate + signed PDF as a downloadable "evidence pack" so users can hand them straight to counsel.
- **Explicitly NOT on the roadmap:** crypto-native arbitration modules (Kleros-style juries, pre-agreed arbitrator addresses). Those add legal/technical complexity to solve a problem the existing legal system already solves. Milestone splits and the long-horizon `rescue()` timeout *are* on the roadmap; arbitration is not.

### 3.5 Wallet UX

- **Decision:** support both paths.
  - **Existing wallet** (MetaMask, Rabby, Core Wallet for Avalanche) via wagmi connectors for users who already have one.
  - **Embedded wallet** (Privy or Dynamic) with "sign in with Google/email" for crypto-new users. Privy has the best multi-chain + embedded UX today and supports exporting keys later if the user graduates to self-custody.
- Gas sponsorship (paymaster / ERC-4337) for the first signing transaction removes the "you need AVAX for gas before you can sign anything" friction. Worth adding if time permits.

### 3.6 Reputation has a privacy problem

- Public contract history means competitors can see your client list, deal cadence, and roughly your revenue. Most businesses will not opt in.
- **Fix:** the *counts* can be public (N contracts completed, N disputes, total value in tiers) without revealing counterparties or amounts. ZK proofs are the ideal long-term answer; for v1, just store the public facts selectively and let users opt individual contracts in/out of their public profile.

### 3.7 Multi-party and amendments

- Real contracts have >2 signers (co-founders, guarantors, witnesses) and get amended mid-flight.
- **Out of scope for v1, but design the schema so it's not painful to add.** The master contract should hold an array of signers, not two named fields.

### 3.8 "DocuSign components"

- DocuSign does not offer a drop-in open-source PDF signing widget. You likely mean **react-pdf** (rendering) + a signature canvas (e.g. `react-signature-canvas`) + field placement. Budget real time for this — it's deceptively fiddly.
- Alternative: **PDF.js** for rendering + custom overlay for signature/date/initial fields.

### 3.9 Gas on Avalanche C-chain

- C-chain fees are low but not zero. Every signature, every release vote, every dispute = a tx. For a $500 contract, $2 in gas is 0.4% — acceptable. For a $50 contract it's 4%. Batch where you can.
- Consider deploying on an **Avalanche L1 (subnet)** for sub-cent fees, if the hackathon sponsors offer this.

---

## 4. Suggested improvements / additions

### 4.1 Architecture (revised)

```
┌───────────────────────────────────────────────────┐
│  Next.js (app router) + React + Tailwind          │
│  - Privy/Web3Auth embedded wallet                 │
│  - react-pdf + signature overlay                  │
│  - wagmi + viem for contract calls                │
└─────────────┬──────────────────────┬──────────────┘
              │                      │
              ▼                      ▼
    ┌──────────────────┐   ┌────────────────────────┐
    │  API routes      │   │  Avalanche C-chain     │
    │  (Next.js)       │   │  - ContractRegistry    │
    │  - SQLite        │   │  - Escrow (per-deal)   │
    │  - Indexer       │   │  - Reputation view     │
    │  - IPFS pinning  │   └────────────────────────┘
    └──────────────────┘              ▲
              │                       │
              └──── Viem event ───────┘
                    subscriptions
              ┌────────────────┐
              │  IPFS/Arweave  │ (encrypted PDFs)
              └────────────────┘
```

### 4.2 Smart contracts (minimum viable)

- **`EscrowFactory`** — deploys `Escrow` instances as **EIP-1167 minimal proxies (clones)** off one immutable implementation. ~45k gas per deal vs ~1.5M for full deploys. Factory itself is UUPS-upgradeable behind a timelocked 2-of-3 multisig, but **only new escrows** are ever affected; existing escrows are immutable forever.
- **`Escrow`** (one clone per agreement, **no admin, no upgrade path**) with state machine:
  - `Draft` → `AwaitingCounterparty` → `Active` → `Released` | `Disputed`
  - Stores: PDF CID, content hash, Party A address, **`keccak256(secret)`** (URL capability), deposit token + amount (`immutable` after init), deadline, `validUntil`, milestone array (optional). Party B's address is populated on first successful `countersign`.
  - Methods: `countersign()`, `releaseToA()`, `refundToB()`, `withdraw()`, `flagDispute()`, `rescue()`.
  - Uses `SafeERC20.safeTransferFrom`; asserts `balanceOf` delta equals `amount` (reverts on fee-on-transfer / blacklist failure). Pull-payment for releases, not push. CEI ordering + `ReentrancyGuard` on every state-changing external function — dNZD is ERC-20 today but hook-variants exist and we should not rely on a non-reentrant token.
  - Token address is `immutable`, set at factory-init of the clone. Governance cannot swap it — that would change what asset depositors are owed.
- **Counterparty gating (anti-griefing) — URL-secret capability model:** Party A generates a random secret at `create`; the contract stores only `keccak256(secret)`. Share link is `https://dealseal.nz/c/<escrow>#<secret>` (secret in the URL **fragment** — never sent to the server, not in server logs or Referer headers). `countersign(secret, ...)` checks `keccak256(secret) == stored` and marks the secret consumed. Escrow has a `validUntil` (e.g. 30 days) so stale links can't be revived.
  - Rationale: without gating, anyone watching the factory events could countersign with a throwaway wallet at the stated deposit amount and state-lock the escrow into deadlock as a DoS. URL-secret raises the attacker's requirement to "possession of the link," which matches DocuSign's email-link security model.
  - Accepted residual risk: mempool front-run. Once B's countersign is pending, the secret is visible; a griefer could copy it and front-run with their own wallet. Exotic attack (still requires depositing the full amount), not worth commit-reveal overhead in v1. Document and defer.
  - Email is captured *inside* the sign flow (for the audit certificate and CCLA compliance), not used for access gating.
- **On-chain attestation:** EIP-712 typed data, not a plain `keccak256` blob.
  - Domain separator pins `chainId` + verifying contract (kills cross-chain replay).
  - Type: `Attestation(address wallet, bytes32 nameHash, bytes32 emailHash, bytes32 pdfHash, uint256 nonce, uint256 deadline)`.
  - `nameHash` / `emailHash` are **salted per-attestation** so off-chain leak of a name/email doesn't enable a rainbow lookup against the chain.
- **`ReputationView`** — read-only helper that aggregates {completed, disputed, dispute-rate, first-seen-at, tier-banded value} per address. Displays tier bands, not raw dollar amounts.
- **`rescue()` path:** if the intended recipient becomes untransferrable (dNZD blacklist, token paused indefinitely), after a hardcoded `RESCUE_TIMEOUT` (≥ 365 days) either party can trigger a path that redirects funds to the non-blacklisted counterparty. Prevents permanent brick from issuer-side actions.

### 4.3 Signing flow (user-visible)

1. **Create.** A uploads PDF → client encrypts → pins to IPFS → A enters Party B's name + email (for the email notification), deposit amount, deadline. Client generates a random URL secret. Escrow clone deployed with `keccak256(secret)` on-chain.
2. **Party A signs.** A uses **Quick Sign** default (auto-appended signature block on the last page; freeform drag-place is v2), signs first field via EIP-712 typed data. System emails Party B the share link with the secret in the URL fragment.
3. **Share link** = `https://dealseal.nz/c/<escrow>#<secret>`. Anyone with the link can *view*; `countersign` requires presenting the secret (preimage of the stored hash). Landing page displays the addressed-to email masked (e.g. `b…@example.com`) so the recipient can self-verify they're the intended party.
4. **Party B countersigns.** B lands on page — *before* any wallet prompt, page shows PDF preview, Party A's name, deposit amount in NZD, and a 3-step progress (Review → Sign & Pay → Done). B signs in (Privy/Dynamic or existing wallet), verifies their own email via OTP *for the audit certificate* (not for access), views PDF, draws signature, confirms amount (typed-amount confirmation for deposits >$1,000 NZD). **One tx** via multicall: `countersign(secret, attestation)` + `safeTransferFrom` of dNZD into escrow, atomic. This atomicity is the product.
5. **Receipt.** Explicit copy: "Your $X NZD is held in escrow, not paid to Acme yet. You decide when to release it to them; they can release it back to you." Counters the DocuSign "signing is free" mental model.
6. **Release.** Once the deal is `Active`, Party B may call `releaseToA()` to pay Party A, and Party A may call `refundToB()` to release funds back to Party B. Neither side can pay themselves; the recipient is hardcoded by direction. On release → state flips to `Released`; anyone may call `withdraw()` (pull-payment) which transitions to `Closed` and moves funds to the recorded recipient.
7. **Audit certificate.** On release, DealSeal generates a signed PDF certificate (copy DocuSign's format): signer identities, timestamps, IPs, user-agents, EIP-712 payload, PDF hash, tx hashes. Required for CCLA s.229 record-keeping and defensible in a NZ dispute. *Implemented:* `GET /api/contracts/<addr>/certificate` builds the cert on demand from on-chain state + off-chain attestations and serves it as a PDF; `POST` to the same route pins the cert to IPFS (idempotent, only pins once `Released`/`Closed`). The release page auto-triggers the pin on terminal state.

### 4.4 Off-chain DB (SQLite is fine for hackathon)

Purely an **index + UX cache**. Nothing authoritative:
- Contract metadata for list views (title, parties' display names, created_at).
- Email/name attestations linked to wallets.
- Notification queue (email the counterparty a share link).
- Field placement JSON for the PDF overlay.

### 4.5 Demo-day polish (don't skip)

- Pre-fund two test wallets with test dNZD on Avalanche Fuji; pre-verify both emails before going on stage (OTP live on hotel wifi *will* fail).
- Seed three "completed" contracts on one of the wallets so reputation is non-empty.
- **Three-tier fallback ladder** if the live tx fails mid-demo:
  1. Retry on a second pre-funded wallet pair.
  2. Switch to local **Anvil fork** of Fuji running the same contracts with instant blocks.
  3. Play a 60-second pre-recorded screen capture.
- One-click "reset demo" button on a hidden `/demo` route that redeploys fresh escrows.
- **The memorable moment:** split-screen, two laptops. Left = contractor. Right = client. Client clicks Sign → in one transaction the PDF goes green-checked AND the dNZD number animates from client wallet into the escrow card. Cut to contractor's reputation incrementing from 12 → 13. Rehearse 20 times.

### 4.6 Yield on escrow — Aave (opt-in, USDC-only)

Deposits route through **Aave V3 on Avalanche** while sitting in escrow; interest is skimmed to a platform wallet at withdraw, principal returns to the payee. Lifted from §5 stretch into v1 because it's the platform's only revenue lever and doesn't change the user-facing flow.

**Configured at factory deploy** (all-or-nothing, immutable):
- `aavePool` — Aave V3 Pool address.
- `platformWallet` — interest sink.
- `aaveSupportedToken` — single ERC-20 routed through Aave (USDC on Avalanche). Tokens *other* than this never touch Aave, so dNZD (not Aave-listed) keeps working unchanged. The constructor reverts on partial config — all three set, or all three zero.

**Per-clone behaviour:**
- `countersign()` — supplies the deposit only if `token == aaveSupportedToken && aavePool != 0`. Uses `SafeERC20.forceApprove` (handles USDT-style allowance quirks). For non-Aave tokens, behaviour is unchanged from pre-Aave.
- `withdraw()` — pulls principal + interest in one Aave call. **Reverts on shortfall** (pool paused / capped / illiquid). The "state change then call" ordering means the revert unwinds state back to `Released`, and the recipient can retry once Aave is healthy. Never silently sends less than the released amount.
- `rescue()` — best-effort `try/catch` Aave drain, then sweeps `token.balanceOf(this)`. Aave being broken is a plausible *cause* of needing rescue, so rescue must not depend on a healthy pool.

**Why USDC-only (not "any Aave-listed asset"):** the factory has no admin and no upgrade path for an allowlist. Pinning to one token is the simplest static config that doesn't risk a future Aave listing changing security assumptions. Adding more tokens = redeploy the factory (acceptable — only affects new clones, in line with §4.2).

---

## 5. Stretch ideas (post-hackathon, or if you have slack)

- **In-flow fiat on-ramp.** Party B pays by card → Transak/Onramper mints dNZD → deposit happens in the same flow. Removes the "counterparty has no dNZD" dead end. Worth doing early-post-hackathon; too much moving-part risk for the demo itself.
- **Commit-reveal countersign.** Eliminates the mempool front-run risk on the URL secret. Two-tx UX; only worth it if the exotic attack actually shows up.
- ~~**Arbitration module.**~~ Removed — disputes are resolved off-chain via the traditional legal system (§3.4). The smart contract holds funds and produces evidence; it does not adjudicate.
- **Milestone splits.** Break the deposit into milestones, each released independently.
- ~~**Yield on escrow.**~~ Pulled in to v1 — see §4.6. USDC-only, single Aave V3 pool, all-or-nothing factory config. Interest goes to the platform, not split with parties (revenue lever for the platform, simpler accounting).
- **Verifiable credentials for identity.** Integrate with a DID method (did:ethr, did:pkh) so reputation is portable across platforms.
- **ZK-proof of "I have completed ≥10 contracts with zero disputes"** without revealing which contracts. Real reputation killer-feature.
- **Template marketplace.** NZ-specific templates (IRD-compliant, CCCFA-aware, etc.) as a paid upsell.
- **Fiat off-ramp at release.** Payee cashes out directly to a NZ bank account via a licensed partner.
- **Reputation keyed on ENS** (see §10, currently on hold).

---

## 6. Name — locked in

**DealSeal.** Short, legal-resonant ("seal the deal"), searchable. Register `dealseal.nz` + socials before making a logo.

---

## 7. Scope for the hackathon

**Must have (demo floor):**
- PDF upload → IPFS pin → hash on-chain.
- Two-party signing with atomic sign + deposit (dNZD) for Party B.
- URL-secret-gated countersign; landing page shows masked addressed-to email.
- Quick Sign (auto-appended signature block) — no drag-place.
- Release on mutual approval; asymmetric default (payee proposes, payer one-tap approves).
- Basic reputation page: tiered counts (completed / disputed / dispute-rate / first-seen-at), not raw dollars.
- Embedded wallet (Privy or Dynamic) **and** existing-wallet (wagmi) path.
- Mobile-responsive contract page: pinch-zoom PDF, finger-sized signature canvas, one-tap approve.
- ToS banner: "Demonstration only, Fuji testnet, no real funds, no NZ residents."

**Should have:**
- Email notification to counterparty with share link; subject line shows dollar amount.
- Audit certificate PDF generated on release (CCLA s.229 compliance).
- Dispute flag that freezes auto-release and surfaces on reputation.
- Encrypted PDFs (only signers can decrypt).
- Release nudges at +3 / +7 / +14 days.
- Contracts dashboard (`/contracts`) for each party.

**Nice to have:**
- Milestone splits.
- USDC fallback if dNZD isn't native on Avalanche.
- Public reputation profile page.
- Gas sponsorship / paymaster for first sign.
- NZBN lookup badge on issuer profile.

**Explicitly out of scope:**
- In-flow fiat on-ramp (stretch, §5).
- Yield on deposits.
- Multi-party (>2) signers.
- Amendments / renegotiation.
- Native mobile app (responsive web only).
- Production KYC / AML.
- Drag-and-drop field placement.

---

## 8. Open questions for you

1. ~~**Token:**~~ Decided: **dNZD (New Money)**. Pending: verify native Avalanche deployment.
2. ~~**Identity:**~~ Decided: **wallet + name + email OTP** at signing (DocuSign-equivalent positioning).
3. ~~**Name:**~~ Decided: **DealSeal**.
4. ~~**ENS on Avalanche:**~~ On hold — see §10.
5. ~~**Counterparty gating:**~~ Decided: **URL-secret capability model** (§4.2).
6. ~~**Dispute fallback:**~~ Decided: deadlock-by-design; disputes resolved off-chain via traditional legal channels (§3.4). On-chain `flagDispute()` freezes funds and records the disagreement; the audit certificate + signed PDF are the artifacts you take to your lawyer. No arbitration module — ever.
7. **Chain:** Fuji testnet for demo (design contracts to be L1-portable). Confirm.
8. **Team size + deadline:** how many people, how many days until the hackathon? Governs what's realistic from §7.
9. **dNZD on Avalanche status:** does New Money have a native C-chain deployment? If not, commit to USDC for the demo and keep dNZD as the roadmap story. Need to email New Money this week.
10. **FMA / FSPA legal posture:** can we get a written opinion or no-action letter before real customers? (See §11.)

---

## 9. Tech decisions locked in

- **Name:** DealSeal.
- **Frontend:** Next.js + React, Tailwind.
- **Deployment:** Docker.
- **PDF signing:** react-pdf + signature canvas (not literal DocuSign SDK); Quick Sign default.
- **Storage:** SQLite (off-chain index only; on-chain is source of truth).
- **Chain:** Avalanche C-chain, Fuji for demo (L1/subnet if sponsor provides).
- **Stablecoin:** dNZD (New Money). Fallback: USDC if dNZD isn't on Avalanche natively.
- **Identity:** wallet + name + email OTP captured at signing; plaintext off-chain, salted hashes on-chain via EIP-712.
- **Wallets:** wagmi connectors for existing wallets + Privy (or Dynamic) embedded for new users.
- **Counterparty gating:** URL-secret capability (secret in URL fragment; `keccak256(secret)` on-chain).
- **Escrow pattern:** EIP-1167 minimal-proxy clones off one immutable implementation. Per-deal escrow is immutable, no admin, no upgrade path. Factory is UUPS-upgradeable behind a timelocked 2-of-3 multisig (affects only new escrows).
- **Smart-contract framework:** Foundry (forge + cast + anvil). Solidity-native tests, fast iteration, emits ABIs that viem/wagmi consume directly.
- **Reputation display:** tiered counts + dispute rate + time-on-platform. Never raw dollar amounts.

---

## 10. ENS as the identity layer — ON HOLD

> **Status:** parked. Not in scope for the hackathon MVP. Keeping the notes so we can pick it back up. For v1, identity = wallet address + name/email attestation (per §3.1). Reputation is keyed on wallet address; we accept that key rotation breaks continuity until we revisit this.

Businesses (Party A, the contractor/startup issuing contracts) are represented by their **ENS domain** (`acme.eth`, `acme.cyphersigner.eth`, etc.). Counterparties see the ENS name, not a raw `0x…` address, at every step. Reputation accrues to the ENS, not the underlying wallet — which means businesses can rotate keys without losing history.

### 10.1 What ENS gives us

- **Human-readable identity.** "Sign contract from `watchful.eth`" lands very differently to "sign contract from `0x7b3c…`". This alone is the single biggest trust improvement in the flow.
- **Portable reputation.** Move the ENS to a new wallet → reputation follows. Lose a wallet → the ENS owner (registered at the registrar level) can reassign resolution.
- **Rich metadata via text records.** Business name, logo (via `avatar`), website, email, NZBN, physical address — all queryable on-chain via standard ENS text records. Party B can see a real business profile before signing.
- **Subdomain delegation.** A business with multiple signatories can issue `jasper.watchful.eth` to each authorised signer. The master contract can check "is this wallet a valid subdomain of the issuing ENS?" — mapping neatly to how a company authorises employees to sign on its behalf.
- **Familiar to the web3 audience.** Judges and users already trust the ENS pattern.

### 10.2 The Avalanche problem

ENS lives on Ethereum mainnet. We're on Avalanche. Two paths:

- **A) CCIP-Read (ENSIP-10) resolution from the frontend.** The Next.js app resolves ENS names against mainnet (via a public RPC or viem's built-in resolver) and passes the resolved address into the Avalanche contract. Simple, but the *contract* on Avalanche can't verify the ENS binding on its own — it trusts what the client passes.
- **B) On-chain mirror via a resolver on Avalanche.** A trusted oracle (or the ENS owner themselves, via a signed message) writes the `ENS → address` binding into a registry contract on Avalanche. The escrow contract then verifies on-chain. More robust, more work.

**Recommendation for v1:** path A — resolve off-chain, store *both* the resolved address and the ENS name (as a string) in the `Escrow`. Display the ENS name everywhere in the UI. Emit events keyed by ENS name so indexers/reputation can aggregate on it.

**Post-hackathon:** add path B (or use ENS's own L2 resolution work — ENSIP-16/19) so contract-level checks don't depend on a trusted client.

### 10.3 Reputation keyed on ENS

Instead of (or in addition to) per-wallet reputation:

- `ReputationView.getStats(ensName)` — returns `{completed, disputed, totalValue, firstSeenAt}` aggregated across every wallet that's ever signed *as* that ENS.
- Public profile page at `/b/acme.eth` shows: avatar, verified text records, completed contract count, dispute rate, first-seen-on-platform date. This is the "trust over time" surface.

### 10.4 Signing model

- Party A (business) signs using a wallet that either **is** the ENS owner or is a valid **subdomain** of the ENS. The escrow verifies this at sign time (on-chain if path B, off-chain + attested if path A).
- Party B signs as themselves — they may or may not have an ENS. If they don't, offer a one-click "claim a free subdomain under `signed.cyphersigner.eth`" on first use. This gives them identity on the platform without needing to buy a `.eth`.
- Rotation: if a business moves the ENS to a new wallet, in-flight contracts still resolve via the ENS at release time — so key rotation doesn't break pending deals.

### 10.5 Risks to track

- **ENS squatting.** Someone registers `anz.eth` and pretends to be ANZ Bank. Mitigation: surface text-record verification (domain-matching email, NZBN lookup) as a badge in the UI. "Unverified" vs "Domain-verified" vs "NZBN-verified" tiers.
- **Mainnet gas to register.** A $20-30 one-time cost to register an ENS may gate small NZ businesses. The `signed.cyphersigner.eth` subdomain flow above sidesteps this for the counterparty side; for the issuing side, it's a cost-of-doing-business we can document.
- **Resolution reliability.** Frontend resolution depends on a mainnet RPC being reachable. Cache resolved addresses in the off-chain DB and refresh periodically.

---

## 11. Regulatory posture (NZ)

Not a substitute for actual legal advice. Get a tech-and-financial-services lawyer (Buddle Findlay, MinterEllisonRuddWatts, Anderson Lloyd) before taking real customer money.

### 11.1 Hackathon demo posture

- **Fuji testnet only.** No real value, no real NZ residents as counterparties on stage.
- **ToS banner on every page:** "Demonstration only. Smart-contract code is the contract. Not for use with consumer transactions or s.227 CCLA-excluded instruments (wills, affidavits, powers of attorney for land)."
- **Never put PII on-chain.** Names, emails, IPs, user-agents stay in SQLite; only salted hashes on-chain.
- **One-line stance for the pitch:** "DealSeal is non-custodial — funds move wallet → smart-contract → wallet, we never touch keys. We charge SaaS fees, not financial intermediation."

### 11.2 Pre-launch gates (before real customers)

| Area | Statute | Action |
|------|---------|--------|
| E-signatures | Contract and Commercial Law Act 2017, Part 4 (s.226–229) | Generate audit certificate PDF on release (signer name, email, IP, UA, OTP events, EIP-712 payload, PDF hash, tx hashes). Retain 7 years. |
| Financial services | FMC Act 2013 + FSP Act 2008 | **Biggest risk.** Escrow may trigger "keeping / administering money on behalf of others." Get FMA no-action letter or written legal opinion. Argument: non-custodial smart contract, no discretion. Counter: we deployed it, set rules, take a fee. |
| AML/CFT | AML/CFT Act 2009 | Either register as a reporting entity (CDD, STR/SAR/PTR, compliance officer, 3-yearly audit) or scope-limit to NZBN-verified businesses with bank-linked onboarding. |
| Privacy | Privacy Act 2020 | Host AWS ap-southeast-2 (Sydney) to avoid IPP-12 cross-border issues. Publish privacy policy. Name a Privacy Officer. 7-year retention aligns with Tax Admin Act. Breach runbook (s.114). Never put PII on-chain (IPP-7 correction + deletion conflict with immutability). |
| Consumer law | CGA 1993 + FTA 1986 | ToS: explicit s.43 CGA contract-out for B2B. FTA s.9 cannot be contracted out — avoid "guaranteed," "funds safe," "legally binding." Use "cryptographic commitment," "smart-contract escrow per the deployed code." |
| GST | GST Act 1985 | Deposit in escrow = not consideration (s.9(2)(b)); GST event at release. ToS: parties responsible for own GST. Platform fee is separate GST-able supply if registered (>$60k/yr). |
| dNZD due diligence | FMC Act (issuer side) | Confirm New Money's FMA exemption / no-action letter before locking dNZD as the default. Get reserve attestation. |

### 11.3 Pre-bake answers for pitch-day judge questions

- *"Is dNZD actually live on Avalanche?"* → Contract address or a one-line roadmap answer.
- *"How is this not unregulated escrow under the FMA?"* → The non-custodial / SaaS-fee line above.
- *"What stops a squatter pretending to be ANZ Bank?"* → NZBN-verified badge tier on the issuer profile (nice-to-have, §7).
- *"Why Avalanche vs Base/Polygon?"* → dNZD lives here, sub-cent fees, NZ-aligned validator presence.
- *"Moat in 18 months?"* → Reputation graph + NZ template library + NZBN integration, not the contracts themselves.

---

## 12. Threat model & Foundry invariants

### 12.1 Attack surfaces

| Attack | Surface | Mitigation |
|--------|---------|-----------|
| Griefer countersigns with throwaway wallet, state-locks escrow | Public share link + leaked URL | URL-secret capability (§4.2). Residual: holder of the link. |
| Mempool front-run of countersign | Public mempool on Avalanche C-chain | Accepted for v1 (griefer must still deposit full amount). Commit-reveal upgrade path noted in §5. |
| Signature replay across chains | EIP-712 without chainId pinning | Domain separator pins `chainId` + verifying contract. |
| Reentrancy via token hook | Deposit / release paths | `ReentrancyGuard` + strict CEI + pull-payment releases. `SafeERC20.safeTransferFrom`. |
| Fee-on-transfer / blacklist silent underfund | Deposit path | Assert `balanceOf` delta equals `amount`; revert otherwise. |
| Self-release | Signer tries to release funds to themselves | Directional entrypoints hardcode the opposite party as recipient. |
| Admin-key compromise draining live escrow | Upgradeable escrow | Per-deal escrow is immutable, no admin. Factory upgrades only affect new clones. |
| dNZD pause / blacklist bricks escrow indefinitely | Token-issuer action | `rescue()` path after `RESCUE_TIMEOUT` (≥ 365 days) redirects to non-blacklisted party. |
| Token swap changes asset depositors own | Mutable token address | Token is `immutable` on the escrow clone, set at init. |
| PII leak via on-chain data | Naïve commitment format | Name/email stored as **salted** hashes (per-attestation salt); plaintext only off-chain. |
| Stale share link revived months later | Capability reuse | `validUntil` on the escrow; secret marked consumed on first successful countersign. |
| Aave shortfall silently shrinks payout | `withdraw` path with Aave enabled (§4.6) | `withdraw` reverts on `totalWithdrawn < amt` and the state revert lets the recipient retry once Aave is healthy. Never sends less than the released amount. |
| Aave outage permanently bricks rescue | `rescue` path with Aave enabled | Aave drain is `try/catch`; rescue then sweeps `token.balanceOf` regardless. Funds left in a paused pool are recoverable later via a follow-up `withdraw`. |
| Aave brick on non-listed asset deposit | `countersign` with Aave globally enabled | Per-clone gate: only `aaveSupportedToken` clones touch Aave. dNZD and other unlisted assets bypass the supply call entirely. |
| Stale ERC-20 allowance to Aave Pool blocks subsequent supply | USDT-style tokens reverting on non-zero→non-zero allowance | `SafeERC20.forceApprove` zeroes first, then sets, on every supply. |

### 12.2 Foundry invariants to write

- `sum(escrow.balances) == token.balanceOf(escrow)` always.
- Released funds == initial deposit (no inflation, no loss) modulo fee-on-transfer revert.
- State machine: no transition out of `Released`; `Disputed` reachable only from `Active`; no transition back to `Draft`.
- Only `partyA` / `partyB` can advance state — fuzz with random callers.
- Signature replay: same EIP-712 sig cannot be used twice; fuzz across chainIds to confirm domain separator defeats cross-chain replay.
- Symbolic check (`halmos`) on release/withdraw: no input causes funds to flow to a non-signer address.
- URL-secret: `countersign` reverts if preimage doesn't match stored hash; succeeds exactly once; reverts after `validUntil`.
- `rescue()` is unreachable before `RESCUE_TIMEOUT`.
- **Aave (§4.6):** for any clone deployed against an Aave-enabled factory + supported token: post-`withdraw`, the release recipient's net token balance increases by exactly `amount`, and `platformWallet`'s balance increases by exactly `aBalance - amount` at withdraw time. Across `withdraw` + `rescue` paths, no token sits stranded on the clone (`token.balanceOf(clone) == 0` after termination).
- **Aave (§4.6):** for any clone deployed against an Aave-disabled factory or a non-supported token: clone never calls into the Aave pool (mock pool reverts on any call → all happy-path tests still pass).
