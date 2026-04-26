import type { Metadata } from "next";
import { BrandMark } from "@/components/AppShell";
import { StateMachine } from "@/components/StateMachine";
import { activeChain, depositToken } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Graph - DealSeal",
  description: "Blockchain function graph for DealSeal contracts.",
};

const contracts = [
  {
    name: "EscrowFactory",
    role: "Creates and indexes per-deal escrows.",
    functions: [
      "createEscrowDeterministic(...)",
      "recordCountersign(address partyB)",
      "predictAddress(bytes32 salt)",
      "escrowCount()",
      "partyEscrowCount(address)",
    ],
  },
  {
    name: "Escrow",
    role: "One immutable deal state machine per agreement.",
    functions: [
      "initialize(...)",
      "countersign(bytes32 secret, ...)",
      "releaseToA()",
      "refundToB()",
      "withdraw()",
      "flagDispute(string reason)",
      "cancelDispute()",
      "rescue()",
      "domainSeparator()",
    ],
  },
  {
    name: "ReputationView",
    role: "Read-only history summary for a wallet.",
    functions: ["statsOf(address party)"],
  },
] as const;

export default function GraphPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandMark />
          <div className="font-mono text-muted" style={{ fontSize: 11 }}>
            {activeChain.name} / {depositToken.symbol} / blockchain function graph
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <div>
            <div className="font-mono uppercase text-accent" style={{ fontSize: 11, letterSpacing: 2 }}>
              On-chain function map
            </div>
            <h1 className="mt-3 max-w-4xl font-serif font-normal" style={{ fontSize: 54, lineHeight: 1.02 }}>
              A graph of the blockchain functions that move a deal from draft to payout.
            </h1>
          </div>
          <div className="border border-rule bg-card p-5">
            <p className="leading-relaxed text-ink/75" style={{ fontSize: 14 }}>
              This page focuses on the smart-contract side only: factory creation,
              escrow state changes, release approval, dispute handling, rescue,
              and the reputation read model.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono uppercase" style={{ fontSize: 10, letterSpacing: 1 }}>
              <Tag>deterministic clone</Tag>
              <Tag>symmetric release</Tag>
              <Tag>optional yield</Tag>
              <Tag>read-only stats</Tag>
            </div>
          </div>
        </div>

        <div className="mt-8 overflow-x-auto border border-rule bg-card p-4">
          <BlockchainFlowGraph />
        </div>
      </section>

      <section className="border-y border-rule bg-paper-2">
        <div className="mx-auto grid max-w-7xl gap-5 px-6 py-8 lg:grid-cols-3">
          {contracts.map((contract) => (
            <article key={contract.name} className="border border-rule bg-card p-5">
              <div className="font-mono uppercase text-accent" style={{ fontSize: 10, letterSpacing: 1.5 }}>
                {contract.name}
              </div>
              <h2 className="mt-2 font-serif font-normal" style={{ fontSize: 28 }}>
                {contract.role}
              </h2>
              <ul className="mt-4 space-y-2 font-mono text-ink/75" style={{ fontSize: 12, lineHeight: 1.45 }}>
                {contract.functions.map((fn) => (
                  <li key={fn} className="border-l border-rule pl-3">
                    {fn}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <div className="font-mono uppercase text-muted" style={{ fontSize: 11, letterSpacing: 2 }}>
              Contract state machine
            </div>
            <h2 className="mt-3 font-serif font-normal" style={{ fontSize: 42, lineHeight: 1.05 }}>
              The lifecycle is strict, and every function moves it forward or freezes it.
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-ink/75" style={{ fontSize: 15 }}>
              `Escrow.sol` is the core state machine. The diagram below mirrors the
              same execution path the contract enforces on-chain.
            </p>
          </div>

          <div className="border border-rule bg-card px-6 py-8">
            <StateMachine />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-12">
        <div className="border border-rule bg-ink px-6 py-5 text-paper">
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            <MiniStat label="Entry point" value="createEscrowDeterministic()" />
            <MiniStat label="Money move" value="countersign() + transferFrom" />
            <MiniStat label="Release gate" value="releaseToA() / refundToB()" />
            <MiniStat label="Fallback" value="flagDispute() / rescue()" />
          </div>
        </div>
      </section>
    </main>
  );
}

function BlockchainFlowGraph() {
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
      viewBox="0 0 1440 800"
      width="1440"
      height="800"
      role="img"
      aria-label="Graph of DealSeal blockchain functions and state flow"
      style={{ display: "block", maxWidth: "none" }}
    >
      <rect x="0" y="0" width="1440" height="800" fill={card} />

      <Lane y={78} label="Factory layer" />
      <Lane y={250} label="Escrow layer" />
      <Lane y={422} label="Token / yield layer" />
      <Lane y={594} label="Read model" />

      <Node x={46} y={104} w={300} h={106} title="EscrowFactory.createEscrowDeterministic" lines={["cloneDeterministic", "initialize clone", "emit EscrowCreated"]} tone="accent" />
      <Node x={392} y={104} w={280} h={106} title="Escrow.initialize" lines={["store deal terms", "verify Party A signature", "state -> AwaitingCounterparty"]} />
      <Node x={722} y={104} w={314} h={106} title="EscrowFactory.recordCountersign" lines={["called only by deployed clones", "index Party B", "emit EscrowCountersigned"]} tone="green" />
      <Node x={1088} y={104} w={266} h={106} title="predictAddress" lines={["lets Party A pre-sign", "before deployment", "clone address is deterministic"]} tone="amber" />

      <Node x={46} y={276} w={300} h={112} title="Escrow.countersign" lines={["check secret hash", "verify attestation", "deposit token", "state -> Active"]} tone="accent" />
      <Node x={392} y={276} w={280} h={112} title="ERC20.safeTransferFrom" lines={["pull deposit from Party B", "assert exact balance delta", "reject bad token behavior"]} tone="amber" />
      <Node x={722} y={276} w={314} h={112} title="Escrow.releaseToA / refundToB" lines={["B releases to A; A releases to B", "self-pay is impossible", "state -> Released"]} tone="green" />
      <Node x={1088} y={276} w={266} h={112} title="Escrow.withdraw" lines={["pull principal back", "optional Aave unwind", "state -> Closed"]} />

      <Node x={46} y={456} w={300} h={108} title="Escrow.flagDispute / cancelDispute" lines={["freeze deal", "store reason", "restore exact prior state"]} tone="accent" />
      <Node x={392} y={456} w={280} h={108} title="Escrow.rescue" lines={["timeout path", "best-effort Aave drain", "state -> Rescued"]} tone="amber" />
      <Node x={722} y={456} w={314} h={108} title="Aave Pool" lines={["supply on countersign", "withdraw on payout", "interest skim to platform"]} tone="green" />
      <Node x={1088} y={456} w={266} h={108} title="platformWallet" lines={["receives yield only", "not principal", "optional integration"]} />

      <Node x={46} y={628} w={300} h={96} title="ReputationView.statsOf" lines={["count completed / disputed / active", "band value tier", "read-only aggregation"]} tone="accent" />
      <Node x={392} y={628} w={280} h={96} title="Factory history index" lines={["partyEscrowCount", "escrowsByParty", "allEscrows"]} />
      <Node x={722} y={628} w={314} h={96} title="Wallet reputation summary" lines={["derived from state", "not stored separately", "no raw amounts required"]} tone="green" />

      <Arrow fromX={346} fromY={156} toX={392} toY={156} label="deploys + initializes" />
      <Arrow fromX={672} fromY={156} toX={722} toY={156} label="records Party B" />
      <Arrow fromX={1042} fromY={156} toX={1088} toY={156} label="address prediction" />

      <Arrow fromX={196} fromY={388} toX={196} toY={456} label="freeze branch" />
      <Arrow fromX={492} fromY={388} toX={492} toY={456} label="fallback" />
      <Arrow fromX={858} fromY={388} toX={858} toY={456} label="optional yield" />
      <Arrow fromX={1211} fromY={388} toX={1211} toY={456} label="payout path" />

      <Arrow fromX={196} fromY={560} toX={196} toY={628} label="summary input" />
      <Arrow fromX={522} fromY={560} toX={522} toY={628} label="history source" />
      <Arrow fromX={878} fromY={560} toX={878} toY={628} label="derived output" />

      <FlowPanel x={1088} y={628} title="Lifecycle" lines={["AwaitingCounterparty", "Active", "Released", "Closed / Disputed / Rescued"]} />

      <text x="46" y="32" fill={ink} fontFamily="var(--font-serif)" fontSize="28">
        Blockchain function graph
      </text>
      <text x="46" y="54" fill={muted} fontFamily="var(--font-mono)" fontSize="11">
        Every labeled box is a Solidity function or on-chain surface. The arrows show the execution path.
      </text>

      <Legend x={1110} y={34} color={accent} label="state machine transitions" />
      <Legend x={1110} y={56} color={green} label="cross-contract calls" />
      <Legend x={1110} y={78} color={amber} label="funds / token flow" />

      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill={ink} />
        </marker>
      </defs>
    </svg>
  );

  function Lane({ y, label }: { y: number; label: string }) {
    return (
      <g>
        <line x1="32" y1={y} x2="1408" y2={y} stroke={rule} strokeDasharray="3 5" />
        <text x="46" y={y - 12} fill={muted} fontFamily="var(--font-mono)" fontSize="11">
          {label.toUpperCase()}
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
    const stroke = tone === "accent" ? accent : tone === "green" ? green : tone === "amber" ? amber : rule;
    const fill =
      tone === "accent"
        ? "rgba(217, 74, 38, 0.06)"
        : tone === "green"
          ? "rgba(47, 122, 74, 0.06)"
          : tone === "amber"
            ? "rgba(231, 181, 54, 0.08)"
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

  function Arrow({
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
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    return (
      <g>
        <line x1={fromX} y1={fromY} x2={toX} y2={toY} stroke={ink} strokeWidth="1.2" markerEnd="url(#arrowhead)" />
        {label && (
          <text x={midX + 10} y={midY - 6} fill={muted} fontFamily="var(--font-mono)" fontSize="10">
            {label}
          </text>
        )}
      </g>
    );
  }

  function FlowPanel({ x, y, title, lines }: { x: number; y: number; title: string; lines: string[] }) {
    return (
      <g>
        <rect x={x} y={y} width="266" height="96" fill={paper} stroke={rule} />
        <text x={x + 16} y={y + 24} fill={ink} fontFamily="var(--font-sans)" fontSize="14" fontWeight="600">
          {title}
        </text>
        {lines.map((line, idx) => (
          <text key={line} x={x + 16} y={y + 46 + idx * 14} fill={muted} fontFamily="var(--font-mono)" fontSize="10">
            {line}
          </text>
        ))}
      </g>
    );
  }

  function Legend({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
    return (
      <g>
        <rect x={x} y={y - 9} width="10" height="10" fill={color} />
        <text x={x + 16} y={y} fill={muted} fontFamily="var(--font-mono)" fontSize="11">
          {label}
        </text>
      </g>
    );
  }
}

function Tag({ children }: { children: string }) {
  return (
    <span className="border border-rule px-2 py-1 text-[10px]" style={{ letterSpacing: 1 }}>
      {children}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono uppercase text-paper/60" style={{ fontSize: 10, letterSpacing: 1.5 }}>
        {label}
      </div>
      <div className="mt-1 font-serif" style={{ fontSize: 22, lineHeight: 1.15 }}>
        {value}
      </div>
    </div>
  );
}
