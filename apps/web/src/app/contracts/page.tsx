import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { desc } from "drizzle-orm";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ContractsPage() {
  const rows = await db
    .select()
    .from(contracts)
    .orderBy(desc(contracts.createdAt))
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Contracts</h1>
      <ul className="mt-6 divide-y divide-[color:var(--color-border)] rounded-lg border border-[color:var(--color-border)]">
        {rows.length === 0 && (
          <li className="px-4 py-6 text-sm text-zinc-500">
            No contracts yet. <Link className="text-[color:var(--color-accent)]" href="/new">Create one →</Link>
          </li>
        )}
        {rows.map((c) => (
          <li key={c.id} className="px-4 py-3 hover:bg-[color:var(--color-surface)]">
            <Link href={`/c/${c.escrowAddress ?? c.id}`} className="block">
              <div className="font-medium">{c.title}</div>
              <div className="text-xs text-zinc-500">
                {c.state} · {c.depositAmount} {c.depositToken}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
