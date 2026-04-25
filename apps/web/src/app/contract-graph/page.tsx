import type { Metadata } from "next";
import { BrandMark } from "@/components/AppShell";
import { activeChain, depositToken } from "@/lib/chain";

export const metadata: Metadata = {
  title: "Contract graph - DealSeal",
  description: "Internal map of the DealSeal contract lifecycle.",
};

const lifecycle = [
  {
    state: "AwaitingCounterparty",
    trigger: "createEscrowDeterministic",
    actor: "Party A",
    effect: "Clone exists, Party A attestation is stored, share secret hash is committed.",
  },
  {
    state: "Active",
    trigger: "countersign",
    actor: "Party B",
    effect: "Secret is consumed, Party B attestation is stored, deposit is pulled into escrow.",
  },
  {
    state: "Releasing",
    trigger: "proposeRelease",
    actor: "Either signer",
    effect: "One signer says the work is complete; the other signer must approve.",
  },
  {
    state: "Released",
    trigger: "approveRelease",
    actor: "Other signer",
    effect: "Principal becomes withdrawable to Party A.",
  },
  {
    state: "Closed",
    trigger: "withdraw",
    actor: "Anyone",
    effect: "Funds are pulled from escrow/Aave and sent to Party A.",
  },
];

const apiRoutes = [
  ["/api/ipfs", "Pins the uploaded PDF and stamped audit copies."],
  ["/api/contracts", "Indexes Party A's deal only after on-chain clone verification."],
  ["/api/contracts/[address]", "Feeds the counterparty page and dashboard detail views."],
  ["/api/contracts/[address]/countersign", "Indexes Party B after the chain says countersign landed."],
  ["/api/contracts/[address]/signed", "Updates the latest human-readable signed PDF CID."],
  ["/api/contracts/[address]/pdf", "Streams original or stamped PDF from IPFS."],
];

const invariants = [
  "The PDF hash, token, amount, Party A wallet, deadline, link expiry, and secret hash are immutable after initialize.",
  "The share URL secret lives in the browser fragment; the server stores only keccak256(secret).",
  "Party B's signature and deposit settle in the same countersign transaction after token approval.",
  "The off-chain index is never trusted on write; API routes read the escrow clone before saving state.",
  "Release needs two distinct signers: the proposer cannot approve their own proposal.",
  "Dispute pauses Active or Releasing, then cancellation restores the exact previous state.",
];

const artifacts = [
  ["Original PDF", "sha256 committed on chain, CID stored in clone and index."],
  ["EIP-712 attestations", "Wallet, salted name/email hashes, PDF hash, nonce, deadline."],
  ["Signed PDF copy", "Best-effort audit artifact with drawn signatures; not the on-chain hash."],
  ["SQLite index", "Dashboard/search metadata plus names, emails, masked counterparty details."],
  ["Factory registry", "Escrows by Party A at create time, Party B after countersign."],
];

export default function ContractGraphPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-rule bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <BrandMark />
          <div className="font-mono text-muted" style={{ fontSize: 11 }}>
            Hidden internal map / {activeChain.name} / {depositToken.symbol}
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-7 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div
              className="font-mono uppercase text-accent"
              style={{ fontSize: 11, letterSpacing: 0 }}
            >
              Contract lifecycle graph
            </div>
            <h1
              className="mt-2 max-w-4xl font-serif font-normal"
              style={{ fontSize: 52, lineHeight: 1.05, letterSpacing: 0 }}
            >
              How a DealSeal contract moves from uploaded PDF to locked deposit
              to release.
            </h1>
          </div>
          <div
            className="border border-rule bg-card p-5"
            style={{ alignSelf: "end" }}
          >
            <p className="leading-relaxed text-ink/75" style={{ fontSize: 14 }}>
              Read this left to right. The top lane is the user experience, the
              middle lane is the app and API index, and the bottom lane is the
              escrow clone on chain.
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
          <RoutePanel />
          <ArtifactPanel />
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
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {lifecycle.map((item) => (
            <div key={item.state} className="border border-rule bg-card p-4">
              <div
                className="font-mono uppercase text-accent"
                style={{ fontSize: 10, letterSpacing: 0 }}
              >
                {item.trigger}
              </div>
              <h3 className="mt-2 font-serif font-normal" style={{ fontSize: 24 }}>
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
      viewBox="0 0 1340 720"
      width="1340"
      height="720"
      role="img"
      aria-label="Detailed graph of the DealSeal contract flow"
      style={{ display: "block", maxWidth: "none" }}
    >
      <rect x="0" y="0" width="1340" height="720" fill={card} />

      <Lane y={64} label="Party A client" />
      <Lane y={242} label="API and index" />
      <Lane y={420} label="Escrow factory and clone" />
      <Lane y={598} label="Party B client" />

      <Node x={54} y={92} w={184} h={96} title="Upload PDF" lines={["extract fields", "choose token + amount", "draw signature"]} />
      <Node x={284} y={92} w={210} h={96} title="Hash + attest" lines={["sha256(pdf)", "salt name/email", "sign EIP-712"]} />
      <Node x={542} y={92} w={220} h={96} title="Deploy clone" lines={["predictAddress(salt)", "createEscrowDeterministic", "wait for receipt"]} tone="accent" />
      <Node x={810} y={92} w={186} h={96} title="Share link" lines={["/c/escrow#secret", "fragment stays local", "validUntil <= deadline"]} />

      <Node x={542} y={270} w={220} h={98} title="POST /api/contracts" lines={["readEscrow(address)", "verify state + partyA", "save metadata"]} tone="green" />
      <Node x={810} y={270} w={186} h={98} title="Counterparty GET" lines={["load index row", "mask email", "stream PDF preview"]} />
      <Node x={1050} y={270} w={214} h={98} title="POST countersign" lines={["readEscrow again", "verify partyB", "update state + attestation"]} tone="green" />

      <Node x={542} y={448} w={220} h={102} title="Factory" lines={["cloneDeterministic", "registry: Party A", "initialize clone"]} />
      <Node x={810} y={448} w={186} h={102} title="Awaiting" lines={["partyA set", "pdfHash set", "secretHash set"]} tone="amber" />
      <Node x={1050} y={448} w={214} h={102} title="Active escrow" lines={["secret consumed", "partyB set", "deposit held/supplied"]} tone="accent" />

      <Node x={810} y={626} w={186} h={58} title="Review link" lines={["read secret from #"]} />
      <Node x={1050} y={626} w={214} h={58} title="Sign + deposit" lines={["approve token, then countersign"]} tone="accent" />

      <Flow fromX={238} fromY={140} toX={284} toY={140} />
      <Flow fromX={494} fromY={140} toX={542} toY={140} />
      <Flow fromX={762} fromY={140} toX={810} toY={140} />
      <Flow fromX={652} fromY={188} toX={652} toY={270} label="index after receipt" />
      <Flow fromX={652} fromY={448} toX={652} toY={368} />
      <Flow fromX={762} fromY={497} toX={810} toY={497} />
      <Flow fromX={903} fromY={550} toX={903} toY={626} />
      <Flow fromX={996} fromY={655} toX={1050} toY={655} />
      <Flow fromX={1157} fromY={626} toX={1157} toY={550} label="countersign(secret)" />
      <Flow fromX={1157} fromY={550} toX={1157} toY={368} label="server verifies" />
      <Flow fromX={996} fromY={319} toX={1050} toY={319} />
      <Flow fromX={996} fromY={497} toX={1050} toY={497} />

      <Branch x={1140} y={430} />

      <text x="54" y="32" fill={ink} fontFamily="var(--font-serif)" fontSize="28">
        Main settlement path
      </text>
      <text x="54" y="54" fill={muted} fontFamily="var(--font-mono)" fontSize="11">
        Solid arrows are required order. Dashed branches are release, dispute, and rescue paths after Active.
      </text>

      <Legend x={1016} y={34} color={accent} label="wallet transaction" />
      <Legend x={1016} y={56} color={green} label="server verification" />
      <Legend x={1016} y={78} color={amber} label="on-chain state" />

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
    const fill = tone === "accent" ? "rgba(217, 74, 38, 0.055)" : tone === "green" ? "rgba(47, 122, 74, 0.055)" : tone === "amber" ? "rgba(231, 181, 54, 0.075)" : paper;

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

  function Branch({ x, y }: { x: number; y: number }) {
    return (
      <g>
        <path
          d={`M ${x} ${y} C ${x + 60} ${y - 42}, ${x + 80} ${y - 110}, ${x + 112} ${y - 150}`}
          fill="none"
          stroke={amber}
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <path
          d={`M ${x} ${y + 22} C ${x + 62} ${y + 58}, ${x + 84} ${y + 94}, ${x + 112} ${y + 122}`}
          fill="none"
          stroke={ink}
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <path
          d={`M ${x - 18} ${y + 80} C ${x - 120} ${y + 92}, ${x - 164} ${y + 102}, ${x - 224} ${y + 120}`}
          fill="none"
          stroke={accent}
          strokeWidth="1.2"
          strokeDasharray="4 4"
        />
        <MiniState x={1212} y={236} title="Releasing" note="one signer proposed" />
        <MiniState x={1212} y={558} title="Released" note="other signer approved" />
        <MiniState x={850} y={586} title="Disputed" note="pause or restore" accent />
        <MiniState x={1030} y={586} title="Rescued" note="365d after deadline" />
      </g>
    );
  }

  function MiniState({
    x,
    y,
    title,
    note,
    accent: isAccent,
  }: {
    x: number;
    y: number;
    title: string;
    note: string;
    accent?: boolean;
  }) {
    return (
      <g>
        <rect x={x} y={y} width="106" height="54" fill={paper} stroke={isAccent ? accent : rule} />
        <text x={x + 53} y={y + 22} textAnchor="middle" fill={ink} fontFamily="var(--font-sans)" fontSize="13" fontWeight="600">
          {title}
        </text>
        <text x={x + 53} y={y + 40} textAnchor="middle" fill={muted} fontFamily="var(--font-mono)" fontSize="9">
          {note}
        </text>
      </g>
    );
  }

  function Legend({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
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

function InfoPanel({ title, items }: { title: string; items: string[] }) {
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

function RoutePanel() {
  return (
    <div className="border border-rule bg-card p-5">
      <h2 className="font-serif font-normal" style={{ fontSize: 28 }}>
        API Routes
      </h2>
      <div className="mt-4 space-y-3">
        {apiRoutes.map(([route, detail]) => (
          <div key={route} className="border-t border-rule-soft pt-3">
            <div className="font-mono text-accent" style={{ fontSize: 11 }}>
              {route}
            </div>
            <p className="mt-1 text-ink/75" style={{ fontSize: 13, lineHeight: 1.45 }}>
              {detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ArtifactPanel() {
  return (
    <div className="border border-rule bg-card p-5">
      <h2 className="font-serif font-normal" style={{ fontSize: 28 }}>
        Data Artifacts
      </h2>
      <div className="mt-4 space-y-3">
        {artifacts.map(([name, detail]) => (
          <div key={name} className="grid grid-cols-[116px_1fr] gap-3 border-t border-rule-soft pt-3">
            <div className="font-mono text-muted" style={{ fontSize: 11 }}>
              {name}
            </div>
            <p className="text-ink/75" style={{ fontSize: 13, lineHeight: 1.45 }}>
              {detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
