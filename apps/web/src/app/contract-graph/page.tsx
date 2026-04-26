import type { Metadata } from "next";
import { BrandMark } from "@/components/AppShell";
import { activeChain, depositToken } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Contract graph - DealSeal",
  description: "Internal map of DealSeal smart-contract call and state flows.",
};

const lifecycle = [
  {
    state: "AwaitingCounterparty",
    trigger: "createEscrowDeterministic",
    actor: "EscrowFactory -> Escrow",
    effect:
      "Factory deploys deterministic clone, then initialize verifies Party A attestation and commits deal params.",
  },
  {
    state: "Active",
    trigger: "countersign",
    actor: "Party B -> Escrow",
    effect:
      "Escrow checks secret + attestation, pulls deposit, optionally supplies to Aave, and calls factory.recordCountersign.",
  },
  {
    state: "Releasing",
    trigger: "proposeRelease",
    actor: "partyA or partyB",
    effect: "A signer proposes completion; the other signer must approve.",
  },
  {
    state: "Released",
    trigger: "approveRelease",
    actor: "Other signer",
    effect: "Escrow marks principal as withdrawable.",
  },
  {
    state: "Closed",
    trigger: "withdraw",
    actor: "Anyone (pays partyA)",
    effect:
      "Escrow withdraws from Aave if used, routes interest to platformWallet, and transfers principal to partyA.",
  },
  {
    state: "Rescued",
    trigger: "rescue",
    actor: "partyA or partyB",
    effect:
      "After deadline + RESCUE_TIMEOUT, remaining balance can be moved through timeout rescue path.",
  },
] as const;

const contractCalls = [
  [
    "EscrowFactory.createEscrowDeterministic",
    "cloneDeterministic -> initialize clone -> emit EscrowCreated",
  ],
  [
    "Escrow.countersign",
    "secret+attestation validation -> transferFrom -> optional Aave supply -> recordCountersign",
  ],
  ["Escrow.proposeRelease", "Active -> Releasing; saves proposedReleaseBy"],
  [
    "Escrow.approveRelease",
    "Releasing -> Released; proposer cannot self-approve",
  ],
  [
    "Escrow.withdraw",
    "Released -> Closed; optional Aave withdraw + interest skim + principal transfer",
  ],
  [
    "Escrow.flagDispute / cancelDispute",
    "Disputed pause branch with exact prior-state restore",
  ],
  ["Escrow.rescue", "Timeout path into Rescued"],
  [
    "ReputationView.statsOf",
    "Reads factory party escrow list + each escrow state/amount",
  ],
] as const;

const invariants = [
  "token, amount, pdfHash, deadline, validUntil, and secretHash are fixed at initialize.",
  "Attestations bind wallet + pdfHash + nonce + deadline under clone-specific EIP-712 domain.",
  "Only deployed clones can call EscrowFactory.recordCountersign via isEscrow gate.",
  "Release always needs two distinct signers.",
  "Dispute restore returns to the exact preDisputeState.",
] as const;

const contractSurfaces = [
  [
    "EscrowFactory",
    "deterministic clone deployment, escrow registry, Aave config accessors",
  ],
  [
    "Escrow",
    "state machine, attestation checks, deposit/release/dispute/rescue execution",
  ],
  ["IPool (Aave)", "optional supply/withdraw branch for supported token only"],
  ["ReputationView", "read-only aggregation over factory + escrow data"],
  ["ERC20 token", "safeTransferFrom on countersign, safeTransfer on withdraw/rescue"],
] as const;

export default function ContractGraphPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandMark />
          <div className="font-mono text-muted" style={{ fontSize: 11 }}>
            Hidden internal map / smart contracts only / {activeChain.name} / {depositToken.symbol}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="font-mono uppercase text-accent" style={{ fontSize: 11 }}>
              Smart contract flow graph
            </div>
            <h1
              className="mt-2 max-w-4xl font-serif font-normal"
              style={{ fontSize: 52, lineHeight: 1.05 }}
            >
              How EscrowFactory, Escrow, Aave, and ReputationView interact on-chain.
            </h1>
          </div>
          <div className="border border-rule bg-card p-5" style={{ alignSelf: "end" }}>
            <p className="leading-relaxed text-ink/75" style={{ fontSize: 14 }}>
              Left to right is execution order. This graph intentionally excludes UI and API behavior.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto border border-rule bg-card p-4">
          <ContractFlowGraph />
        </div>
      </section>

      <section className="border-y border-rule bg-paper-2">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-7 lg:grid-cols-3">
          <InfoPanel title="Important Invariants" items={invariants} />
          <InfoPanel title="Contract Calls" items={contractCalls.map(([n, d]) => `${n}: ${d}`)} />
          <InfoPanel title="Contract Surfaces" items={contractSurfaces.map(([n, d]) => `${n}: ${d}`)} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-4 flex items-baseline justify-between gap-4">
          <h2 className="font-serif font-normal" style={{ fontSize: 32 }}>
            State Machine
          </h2>
          <span className="font-mono text-muted" style={{ fontSize: 11 }}>
            Escrow.sol enum
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {lifecycle.map((item) => (
            <div key={item.state} className="border border-rule bg-card p-4">
              <div className="font-mono uppercase text-accent" style={{ fontSize: 10 }}>
                {item.trigger}
              </div>
              <h3 className="mt-2 font-serif font-normal" style={{ fontSize: 22 }}>
                {item.state}
              </h3>
              <div className="mt-2 font-mono text-muted" style={{ fontSize: 11 }}>
                {item.actor}
              </div>
              <p className="mt-3 leading-relaxed text-ink/75" style={{ fontSize: 13 }}>
                {item.effect}
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function ContractFlowGraph() {
  const ink = "var(--color-ink)";
  const muted = "var(--color-muted)";
  const accent = "var(--color-accent)";
  const green = "var(--color-green)";
  const amber = "var(--color-amber)";
  const paper = "var(--color-paper)";
  const card = "var(--color-card)";
  const rule = "rgba(10, 10, 10, 0.16)";

  return (
    <svg
      viewBox="0 0 1340 760"
      width="1340"
      height="760"
      role="img"
      aria-label="Detailed graph of DealSeal smart contract flows"
      style={{ display: "block", maxWidth: "none" }}
    >
      <rect x="0" y="0" width="1340" height="760" fill={card} />

      <Lane y={70} label="EscrowFactory" />
      <Lane y={238} label="Escrow clone" />
      <Lane y={406} label="ERC20 + Aave Pool" />
      <Lane y={574} label="ReputationView" />

      <Node x={54} y={98} w={274} h={98} title="createEscrowDeterministic" lines={["cloneDeterministic", "initialize clone", "EscrowCreated"]} tone="accent" />
      <Node x={382} y={98} w={264} h={98} title="Factory registry" lines={["isEscrow[clone] = true", "escrowsByParty[partyA].push", "allEscrows.push"]} />
      <Node x={700} y={98} w={266} h={98} title="recordCountersign" lines={["clone-auth gate", "escrowsByParty[partyB].push", "EscrowCountersigned"]} tone="green" />

      <Node x={54} y={266} w={274} h={104} title="initialize" lines={["verify attestation", "set params", "state AwaitingCounterparty"]} tone="amber" />
      <Node x={382} y={266} w={264} h={104} title="countersign" lines={["check secret + validUntil", "verify partyB", "state Active"]} tone="accent" />
      <Node x={700} y={266} w={266} h={104} title="release path" lines={["proposeRelease", "approveRelease", "withdraw"]} tone="green" />
      <Node x={1020} y={266} w={250} h={104} title="risk path" lines={["flagDispute", "cancelDispute", "rescue"]} />

      <Node x={382} y={434} w={264} h={104} title="ERC20 transfers" lines={["transferFrom deposit", "strict amount check", "transfer principal"]} tone="amber" />
      <Node x={700} y={434} w={266} h={104} title="Aave branch" lines={["supply on countersign", "withdraw on withdraw/rescue", "only supported token"]} tone="green" />
      <Node x={1020} y={434} w={250} h={104} title="Interest route" lines={["withdrawn - principal", "interest -> platformWallet", "principal -> partyA"]} />

      <Node x={382} y={602} w={264} h={90} title="statsOf(party)" lines={["partyEscrowCount", "escrowsByParty(i)", "read state + amount"]} tone="accent" />
      <Node x={700} y={602} w={266} h={90} title="Reputation aggregates" lines={["completed/disputed/active", "value tier", "read-only output"]} />

      <Flow fromX={328} fromY={146} toX={382} toY={146} />
      <Flow fromX={646} fromY={146} toX={700} toY={146} label="after countersign" />

      <Flow fromX={194} fromY={196} toX={194} toY={266} label="initialize" />
      <Flow fromX={646} fromY={318} toX={700} toY={318} />
      <Flow fromX={966} fromY={318} toX={1020} toY={318} />

      <Flow fromX={514} fromY={370} toX={514} toY={434} label="token path" />
      <Flow fromX={780} fromY={370} toX={780} toY={434} label="optional Aave" />
      <Flow fromX={966} fromY={486} toX={1020} toY={486} />

      <Flow fromX={514} fromY={538} toX={514} toY={602} label="read model" />
      <Flow fromX={646} fromY={647} toX={700} toY={647} />

      <StateStrip x={54} y={716} label="Escrow.State: Draft -> AwaitingCounterparty -> Active -> Releasing -> Released -> Disputed/Closed/Rescued" />

      <text x="54" y="32" fill={ink} fontFamily="var(--font-serif)" fontSize="28">
        Solidity call and state topology
      </text>
      <text x="54" y="54" fill={muted} fontFamily="var(--font-mono)" fontSize="11">
        Solid arrows represent direct contract calls or on-chain state transitions.
      </text>

      <Legend x={1020} y={34} color={accent} label="state-changing calls" />
      <Legend x={1020} y={56} color={green} label="cross-contract integration" />
      <Legend x={1020} y={78} color={amber} label="token and funds semantics" />

      <defs>
        <marker
          id="arrow"
          markerWidth="8"
          markerHeight="8"
          refX="7"
          refY="4"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <path d="M0,0 L8,4 L0,8 Z" fill={ink} />
        </marker>
      </defs>
    </svg>
  );

  function Lane({ y, label }: { y: number; label: string }) {
    return (
      <g>
        <line x1="38" y1={y} x2="1302" y2={y} stroke={rule} strokeDasharray="3 5" />
        <text x="54" y={y - 12} fill={muted} fontFamily="var(--font-mono)" fontSize="11">
          {label.toUpperCase()}
        </text>
      </g>
    );
  }

  function StateStrip({ x, y, label }: { x: number; y: number; label: string }) {
    return (
      <g>
        <rect x={x} y={y - 20} width="1260" height="30" fill={paper} stroke={rule} />
        <text x={x + 14} y={y} fill={ink} fontFamily="var(--font-mono)" fontSize="10">
          {label}
        </text>
      </g>
    );
  }

  function Node({
    x,
    y,
    w,
    h,
    title,
    lines,
    tone,
  }: {
    x: number;
    y: number;
    w: number;
    h: number;
    title: string;
    lines: string[];
    tone?: "accent" | "green" | "amber";
  }) {
    const stroke =
      tone === "accent" ? accent : tone === "green" ? green : tone === "amber" ? amber : rule;
    const fill =
      tone === "accent"
        ? "rgba(217, 74, 38, 0.055)"
        : tone === "green"
          ? "rgba(47, 122, 74, 0.055)"
          : tone === "amber"
            ? "rgba(231, 181, 54, 0.075)"
            : paper;

    return (
      <g>
        <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} />
        <text x={x + 16} y={y + 28} fill={ink} fontFamily="var(--font-sans)" fontSize="15" fontWeight="600">
          {title}
        </text>
        {lines.map((line, idx) => (
          <text
            key={line}
            x={x + 16}
            y={y + 52 + idx * 16}
            fill={idx === 0 && tone === "accent" ? accent : muted}
            fontFamily="var(--font-mono)"
            fontSize="11"
          >
            {line}
          </text>
        ))}
      </g>
    );
  }

  function Flow({
    fromX,
    fromY,
    toX,
    toY,
    label,
  }: {
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    label?: string;
  }) {
    const midX = fromX === toX ? fromX : (fromX + toX) / 2;
    const midY = fromY === toY ? fromY - 10 : (fromY + toY) / 2;

    return (
      <g>
        <line
          x1={fromX}
          y1={fromY}
          x2={toX}
          y2={toY}
          stroke={ink}
          strokeWidth="1.2"
          markerEnd="url(#arrow)"
        />
        {label && (
          <text x={midX + 8} y={midY - 6} fill={muted} fontFamily="var(--font-mono)" fontSize="10">
            {label}
          </text>
        )}
      </g>
    );
  }

  function Legend({
    x,
    y,
    color,
    label,
  }: {
    x: number;
    y: number;
    color: string;
    label: string;
  }) {
    return (
      <g>
        <rect x={x} y={y - 10} width="10" height="10" fill={color} />
        <text x={x + 16} y={y} fill={muted} fontFamily="var(--font-mono)" fontSize="11">
          {label}
        </text>
      </g>
    );
  }
}

function InfoPanel({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="border border-rule bg-card p-5">
      <h2 className="font-serif font-normal" style={{ fontSize: 28 }}>
        {title}
      </h2>
      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-ink/75" style={{ fontSize: 13, lineHeight: 1.45 }}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-accent" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
