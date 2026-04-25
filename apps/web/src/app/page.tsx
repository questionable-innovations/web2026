import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-24">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-accent)]">
        DealSeal · web3 NZ 2026
      </p>
      <h1 className="mt-3 text-5xl font-semibold leading-tight">
        Sign the contract.<br />Pay the deposit.<br />
        <span className="text-[color:var(--color-accent)]">In one tap.</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-zinc-400">
        DocuSign for web3. The signature <em>is</em> the money — held in escrow
        on Avalanche until both sides agree it&apos;s done.
      </p>
      <div className="mt-10 flex gap-3">
        <Link
          href="/new"
          className="rounded-md bg-[color:var(--color-accent)] px-5 py-3 font-medium text-black hover:opacity-90"
        >
          Create a contract
        </Link>
        <Link
          href="/contracts"
          className="rounded-md border border-[color:var(--color-border)] px-5 py-3 font-medium hover:bg-[color:var(--color-surface)]"
        >
          My contracts
        </Link>
      </div>
    </main>
  );
}
