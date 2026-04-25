import Link from "next/link";
import { ReactNode } from "react";
import { ArrowRight, CornerDownRight } from "lucide-react";
import { SignPayHero } from "@/components/SignPayHero";
import { StateMachine } from "@/components/StateMachine";
import { activeChain, depositToken } from "@/lib/chain";

const SECTION_PAD = "px-20";

export default function HomePage() {
  return (
    <div className="bg-paper text-ink">
      <TopBar />
      <Hero />
      <KnowYoureBeingPaid />
      <Manifesto />
      <HowItWorks />
      <StateMachineSection />
      <Reputation />
      <ClosingCTA />
      <Footer />
    </div>
  );
}

function TopBar() {
  return (
    <header
      className={`flex items-center justify-between border-b border-rule py-6 ${SECTION_PAD}`}
    >
      <div className="flex items-baseline gap-2">
        <span
          className="font-serif"
          style={{ fontSize: 26, lineHeight: 1, letterSpacing: -0.5 }}
        >
          DealSeal
        </span>
        <span
          className="font-mono uppercase text-muted"
          style={{ fontSize: 10, letterSpacing: 2 }}
        >
          · NZ
        </span>
      </div>
      <nav className="hidden items-center gap-9 text-[14px] md:flex">
        <a href="#how-it-works">How it works</a>
        <a href="#flow">For contractors</a>
        <a href="#reputation">Reputation</a>
        <a href="#trust">Legal &amp; security</a>
      </nav>
      <div className="flex items-center gap-3">
        <Link
          href="/new"
          className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 text-[13px] text-paper"
          style={{ letterSpacing: 0.3 }}
        >
          Sign in
          <ArrowRight size={14} />
        </Link>
      </div>
    </header>
  );
}

function Section({
  children,
  pad = "py-24",
  className = "",
  id,
  border = true,
}: {
  children: ReactNode;
  pad?: string;
  className?: string;
  id?: string;
  border?: boolean;
}) {
  return (
    <section
      id={id}
      className={`${SECTION_PAD} ${pad} ${
        border ? "border-t border-rule" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

function Eyebrow({
  children,
  accent,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className="font-mono uppercase"
      style={{
        fontSize: 11,
        letterSpacing: 2,
        color: accent ? "var(--color-accent)" : "var(--color-muted)",
      }}
    >
      {children}
    </div>
  );
}

function Hero() {
  return (
    <Section pad="pb-16 pt-20" border={false}>
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <Eyebrow accent>{activeChain.name} demo · Web3 NZ 2026</Eyebrow>
          <h1
            className="mt-6 font-serif font-normal"
            style={{ fontSize: 88, lineHeight: 0.98, letterSpacing: -2 }}
          >
            Signing <em className="text-accent">is</em>
            <br />
            paying.
          </h1>
          <p
            className="mt-7 max-w-lg leading-relaxed text-ink/80"
            style={{ fontSize: 19 }}
          >
            DealSeal turns countersigning into the escrow deposit. Party A
            creates the agreement first; Party B completes the deal in one
            on-chain transaction that signs and funds the escrow together.
          </p>
          <div className="mt-9 flex gap-3">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 bg-ink px-6 py-3.5 text-paper"
              style={{ fontSize: 14, letterSpacing: 0.3 }}
            >
              Seal your first contract
              <ArrowRight size={14} />
            </Link>
            <a
              href="#how-it-works"
              className="border border-ink px-6 py-3.5"
              style={{ fontSize: 14 }}
            >
              How it works
            </a>
          </div>
          <div
            className="mt-10 flex flex-wrap gap-7 font-mono uppercase text-muted"
            style={{ fontSize: 11, letterSpacing: 1 }}
          >
            <span>{activeChain.name}</span>
            <span>· {depositToken.symbol} deposit token</span>
            <span>· Non-custodial</span>
          </div>
        </div>
        <div>
          <SignPayHero />
          <div
            className="mt-3.5 flex justify-between font-mono uppercase text-muted"
            style={{ fontSize: 10, letterSpacing: 1 }}
          >
            <span>Fig. 1 · Sign + deposit, atomic</span>
            <span>Live</span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function KnowYoureBeingPaid() {
  const cards = [
    {
      q: "Will they actually pay?",
      a: "They already have.",
      d: "Party B countersigns and funds the escrow in one transaction. If the token transfer fails, the countersign transaction reverts too.",
      meta: "safeTransferFrom + countersign() · atomic",
    },
    {
      q: "What can I verify before signing?",
      a: "The contract page shows the deal itself.",
      d: "Before any wallet prompt, the counterparty flow loads the PDF preview, Party A identity details from the audit record, the deposit amount, and the document hash.",
      meta: "PDF preview · amount · hash",
    },
    {
      q: "Can they pull the deposit back?",
      a: "No. Only mutual approval releases.",
      d: "Each escrow clone has no admin key and no upgrade path. After funding, release still needs both signers to approve, and the final withdrawal pays Party A.",
      meta: "immutable clone · mutual approval",
    },
  ];
  return (
    <Section
      id="trust"
      className="bg-[#ebe7df]"
    >
      <div
        className="mb-12 grid gap-8"
        style={{ gridTemplateColumns: "120px 1fr" }}
      >
        <Eyebrow>§ 00 / Trust</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <h2
            className="m-0 max-w-3xl font-serif font-normal"
            style={{ fontSize: 64, lineHeight: 0.98, letterSpacing: -1.4 }}
          >
            <em className="text-accent">Know</em> you&apos;re being paid
            <br />
            before you start the work.
          </h2>
          <p
            className="m-0 max-w-xs leading-relaxed text-ink/70"
            style={{ fontSize: 15 }}
          >
            The deposit isn&apos;t a promise. Once Party B countersigns, the
            deposit is already in escrow in that same transaction: verifiable,
            on-chain, before the work starts.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 border border-rule bg-paper md:grid-cols-3">
        {cards.map((c, i) => (
          <div
            key={i}
            className="p-8"
            style={{
              borderRight: i < 2 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            <div
              className="mb-4 font-mono uppercase text-muted"
              style={{ fontSize: 10, letterSpacing: 1.5 }}
            >
              The question · {String(i + 1).padStart(2, "0")}
            </div>
            <div
              className="mb-2 font-serif italic text-muted"
              style={{ fontSize: 22, lineHeight: 1.2 }}
            >
              &ldquo;{c.q}&rdquo;
            </div>
            <div
              className="mb-4 font-serif font-normal"
              style={{ fontSize: 30, lineHeight: 1.1, letterSpacing: -0.4 }}
            >
              {c.a}
            </div>
            <div
              className="mb-6 leading-relaxed text-ink/75"
              style={{ fontSize: 14 }}
            >
              {c.d}
            </div>
            <div
              className="inline-flex items-center gap-1.5 border-t border-dashed border-rule pt-3.5 font-mono text-accent"
              style={{ fontSize: 10, letterSpacing: 0.5 }}
            >
              <CornerDownRight size={11} />
              {c.meta}
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-8 grid items-center gap-8 bg-ink px-9 py-7 text-paper"
        style={{ gridTemplateColumns: "220px 1fr" }}
      >
        <div>
          <div
            className="font-mono uppercase"
            style={{
              fontSize: 10,
              letterSpacing: 1.5,
              color: "rgba(255,255,255,0.7)",
            }}
          >
            Held in escrow
          </div>
          <div
            className="mt-1.5 font-serif"
            style={{ fontSize: 44, lineHeight: 1 }}
          >
            $4,800
            <span style={{ fontSize: 18, opacity: 0.6 }}> NZD</span>
          </div>
        </div>
        <div
          className="flex flex-wrap gap-7 font-mono"
          style={{ fontSize: 11, color: "rgba(255,255,255,0.9)" }}
        >
          <ReceiptCell label="Escrow model" value="Per-deal contract clone" />
          <ReceiptCell label="Counterparty link" value="Secret lives in URL fragment" />
          <ReceiptCell label="Release" value="Requires both signers" accent />
        </div>
      </div>
    </Section>
  );
}

function ReceiptCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          color: "rgba(255,255,255,0.6)",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {label.toUpperCase()}
      </div>
      <div style={{ color: accent ? "var(--color-accent)" : undefined }}>
        {value}
      </div>
    </div>
  );
}

function Manifesto() {
  return (
    <Section pad="py-14">
      <div
        className="grid items-start gap-8"
        style={{ gridTemplateColumns: "120px 1fr" }}
      >
        <Eyebrow>§ 01 / Premise</Eyebrow>
        <div
          className="max-w-5xl font-serif font-normal"
          style={{ fontSize: 38, lineHeight: 1.15, letterSpacing: -0.6 }}
        >
          Today, a contract and its deposit are two forms, two systems, and
          two legal risks. <em className="text-accent">&ldquo;I signed but never paid.&rdquo;</em>{" "}
          <em className="text-accent">&ldquo;I paid but never received the doc.&rdquo;</em>
          &nbsp;DealSeal removes both, by removing the gap between them.
        </div>
      </div>
    </Section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Create the escrow draft",
      d: "Party A uploads the PDF, sets the deposit, signs an attestation, and deploys an escrow clone with the PDF hash, token amount, and share-link secret hash.",
    },
    {
      n: "02",
      t: "Send the share link",
      d: "The counterparty receives the escrow link with the secret in the URL fragment. They can load the document and review the amount before they connect a wallet.",
    },
    {
      n: "03",
      t: "They sign + pay, atomic",
      d: `One transaction calls countersign() and transfers ${depositToken.symbol} into escrow. Later, release still requires one signer to propose and the other to approve.`,
    },
  ];
  return (
    <Section id="how-it-works">
      <div
        className="mb-14 grid gap-8"
        style={{ gridTemplateColumns: "120px 1fr" }}
      >
        <Eyebrow>§ 02 / Flow</Eyebrow>
        <h2
          className="m-0 font-serif font-normal"
          style={{ fontSize: 56, lineHeight: 1, letterSpacing: -1 }}
        >
          Three steps. One commitment.
        </h2>
      </div>
      <div className="grid grid-cols-1 border-t border-rule md:grid-cols-3">
        {steps.map((step, i) => (
          <div
            key={step.n}
            className="px-9 py-10"
            style={{
              borderRight: i < 2 ? "1px solid var(--color-rule)" : "none",
            }}
          >
            <div className="mb-6 flex items-baseline justify-between">
              <span
                className="font-serif italic text-accent"
                style={{ fontSize: 56, lineHeight: 1 }}
              >
                {step.n}
              </span>
              <span
                className="font-mono uppercase text-muted"
                style={{ fontSize: 10, letterSpacing: 1 }}
              >
                Step
              </span>
            </div>
            <div
              className="mb-3.5 font-serif"
              style={{ fontSize: 26, lineHeight: 1.15, letterSpacing: -0.3 }}
            >
              {step.t}
            </div>
            <div
              className="max-w-xs leading-relaxed text-ink/75"
              style={{ fontSize: 14 }}
            >
              {step.d}
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function StateMachineSection() {
  return (
    <Section id="flow" className="bg-[#ebe7df]">
      <div
        className="mb-10 grid gap-8"
        style={{ gridTemplateColumns: "120px 1fr" }}
      >
        <Eyebrow>§ 03 / State</Eyebrow>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <h2
            className="m-0 max-w-2xl font-serif font-normal"
            style={{ fontSize: 48, lineHeight: 1, letterSpacing: -1 }}
          >
            The whole protocol fits on a single line.
          </h2>
          <p
            className="m-0 max-w-xs leading-relaxed text-ink/70"
            style={{ fontSize: 14 }}
          >
            This matches the contract enum and methods in `Escrow.sol`,
            including the terminal withdraw and rescue paths.
          </p>
        </div>
      </div>
      <div className="border border-rule bg-paper px-6 py-10">
        <StateMachine />
      </div>
      <div
        className="mt-6 flex flex-wrap gap-8 font-mono uppercase text-muted"
        style={{ fontSize: 10, letterSpacing: 1 }}
      >
        <span>Fig. 2 · Escrow lifecycle</span>
        <span>EIP-1167 minimal proxy</span>
        <span>·</span>
        <span>Closed after withdraw · rescue after timeout</span>
      </div>
    </Section>
  );
}

function Reputation() {
  return (
    <Section id="reputation">
      <div className="grid items-center gap-16 lg:grid-cols-2">
        <div>
          <Eyebrow>§ 04 / Reputation</Eyebrow>
          <h2
            className="my-5 font-serif font-normal"
            style={{ fontSize: 56, lineHeight: 1, letterSpacing: -1 }}
          >
            Carry your record
            <br />
            across borders.
          </h2>
          <p
            className="max-w-md leading-relaxed text-ink/80"
            style={{ fontSize: 17 }}
          >
            Reputation in this build is wallet-based. The app surfaces
            contract counts and dispute status without exposing counterparty
            names or raw payment amounts on the landing page.
          </p>
          <div
            className="mt-8 font-mono"
            style={{ fontSize: 12, letterSpacing: 0.5 }}
          >
            {[
              ["Completed", "counted from released deals"],
              ["Disputed", "counted from disputed deals"],
              ["Dispute rate", "derived from totals"],
              ["First seen", "based on indexed history"],
            ].map(([k, v], i, arr) => (
              <div
                key={k}
                className="flex justify-between"
                style={{
                  borderTop: "1px solid var(--color-rule)",
                  borderBottom:
                    i === arr.length - 1
                      ? "1px solid var(--color-rule)"
                      : "none",
                  padding: "14px 0",
                }}
              >
                <span>{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-rule bg-card p-8">
          <div className="flex items-baseline justify-between">
            <div>
              <Eyebrow>Reputation view</Eyebrow>
              <div
                className="mt-1.5 font-serif"
                style={{ fontSize: 32 }}
              >
                Wallet-scoped profile
              </div>
              <div className="mt-1 text-[13px] text-muted">
                Connected wallet plus indexed contract history
              </div>
            </div>
            <div
              className="bg-accent font-mono text-white"
              style={{
                padding: "6px 12px",
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              PUBLIC SUMMARY
            </div>
          </div>

          <div style={{ height: 28 }} />

          <div
            className="grid grid-cols-3 border border-rule"
            style={{ gap: 1, background: "var(--color-rule)" }}
          >
            {[
              ["Released", "Completed deals"],
              ["Disputed", "Flagged deals"],
              ["First seen", "Indexed start"],
            ].map(([v, l]) => (
              <div key={l} className="bg-card px-4 py-5">
                <div className="font-serif" style={{ fontSize: 36, lineHeight: 1 }}>
                  {v}
                </div>
                <div
                  className="mt-1.5 font-mono uppercase text-muted"
                  style={{ fontSize: 10, letterSpacing: 1 }}
                >
                  {l}
                </div>
              </div>
            ))}
          </div>

          <div style={{ height: 24 }} />
          <div
            className="font-mono text-muted"
            style={{ fontSize: 11, lineHeight: 1.6 }}
          >
            <div>Amounts can be banded instead of shown raw</div>
            <div>Counterparties stay hidden</div>
            <div>Wallet remains the identity anchor</div>
          </div>
        </div>
      </div>
    </Section>
  );
}

function ClosingCTA() {
  return (
    <Section
      pad="py-32"
      border={false}
      className="bg-ink text-paper"
    >
      <div className="grid gap-8" style={{ gridTemplateColumns: "120px 1fr" }}>
        <div
          className="font-mono uppercase"
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "rgba(255,255,255,0.6)",
          }}
        >
          § 05 / Get started
        </div>
        <div>
          <div
            className="font-serif font-normal"
            style={{ fontSize: 72, lineHeight: 1, letterSpacing: -1.5, maxWidth: 980 }}
          >
            Sign in with your wallet.
            <br />
            <em className="text-accent">Seal your first contract</em> in
            under five minutes.
          </div>
          <p
            className="mt-6 max-w-xl leading-relaxed"
            style={{ fontSize: 16, color: "rgba(245,243,238,0.75)" }}
          >
            Start from a wallet session, upload the PDF, set the deposit,
            then send the counterparty link. If Privy is configured, the app
            can also create an embedded wallet during sign-in.
          </p>
          <div className="mt-10 flex flex-wrap gap-3.5">
            <Link
              href="/new"
              className="inline-flex items-center gap-2 bg-accent px-7 py-4 text-white"
              style={{ fontSize: 15, letterSpacing: 0.3 }}
            >
              Sign in &amp; upload your PDF
              <ArrowRight size={16} />
            </Link>
            <Link
              href="/contracts"
              className="px-7 py-4 text-paper"
              style={{
                fontSize: 15,
                border: "1px solid rgba(245,243,238,0.3)",
              }}
            >
              Open my contracts
            </Link>
          </div>
        </div>
      </div>
    </Section>
  );
}

function Footer() {
  return (
    <footer
      className={`flex flex-wrap items-center justify-between bg-ink py-12 font-mono text-paper ${SECTION_PAD}`}
      style={{
        fontSize: 11,
        letterSpacing: 1,
        borderTop: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <span>DEALSEAL.NZ · © 2026</span>
      <span>{`NON-CUSTODIAL · ${activeChain.name.toUpperCase()} · ${depositToken.symbol.toUpperCase()} DEPOSIT FLOW`}</span>
      <span>
        <a
          href="https://github.com/questionable-innovations/web2026"
          target="_blank"
          rel="noreferrer"
        >
          SOURCE
        </a>
        {" · "}
        <a
          href="https://github.com/questionable-innovations/web2026/tree/main/contracts"
          target="_blank"
          rel="noreferrer"
        >
          CONTRACTS
        </a>
        {" · "}
        <a
          href="https://github.com/questionable-innovations/web2026/blob/main/LICENSE.md"
          target="_blank"
          rel="noreferrer"
        >
          LEGAL
        </a>
      </span>
    </footer>
  );
}
