import { eq, inArray, desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { AdminContractsTable } from "./AdminContractsTable";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  // Fetch active contracts (which means they're deployed)
  // For demo, we just fetch all contracts that are not just "Draft"
  const activeContracts = await db
    .select()
    .from(contracts)
    .where(inArray(contracts.state, ["Active", "Releasing", "Disputed"]))
    .orderBy(desc(contracts.createdAt));

  return (
    <div className="container mx-auto py-10 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Platform Admin</h1>
        <p className="text-muted-foreground max-w-2xl">
          Monitor active escrow contracts and platform interest gains from Aave integration.
        </p>

        <AdminContractsTable contracts={activeContracts} />
      </div>
    </div>
  );
}