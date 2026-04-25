import { inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { AdminContractsTable } from "./AdminContractsTable";
import { AppNav } from "@/components/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  // Funds are in Aave (and accruing) until withdraw() lands and state
  // becomes Closed. Released still holds the deposit, so include it —
  // otherwise the interest readout drops to zero the moment both parties
  // approve, even though the money is still in the pool.
  const activeContracts = await db
    .select()
    .from(contracts)
    .where(inArray(contracts.state, ["Active", "Releasing", "Released", "Disputed"]))
    .orderBy(desc(contracts.createdAt));

  return (
    <div className="min-h-screen bg-stone-50">
      <AppNav active={"admin"} />
      <div className="container mx-auto py-10 px-4 md:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">Platform Admin</h1>
          <p className="text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Monitor active escrow contracts and platform interest gains from Aave integration.
          </p>

          <AdminContractsTable contracts={activeContracts} />
        </div>
      </div>
    </div>
  );
}