import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contracts } from "@/server/db/schema";
import { AdminContractsTable } from "./AdminContractsTable";
import { AppNav } from "@/components/AppShell";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminPage() {
  let loadError: string | null = null;
  let activeContracts: (typeof contracts.$inferSelect)[] = [];
  try {
    activeContracts = await db
      .select()
      .from(contracts)
      .orderBy(desc(contracts.createdAt));
  } catch (error: unknown) {
    loadError =
      error instanceof Error
        ? error.message
        : "Unable to read the contract index.";
  }

  // Ensure dates are parsed to strings to avoid Next.js Server-to-Client serialization issues
  const serializedContracts = activeContracts.map((c) => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div className="min-h-screen bg-paper">
      <AppNav active={"admin"} />
      <div className="px-5 py-7 md:px-9 md:py-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-7 flex flex-col gap-4 border-b border-rule pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="ds-eyebrow">Platform operations</div>
              <h1
                className="mt-1.5 font-serif font-normal"
                style={{ fontSize: 44, lineHeight: 1.08 }}
              >
                Admin overview
              </h1>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted">
              Full contract inventory with Aave yield monitoring, contract state
              mix, and funding visibility across the platform.
            </p>
          </div>

          <AdminContractsTable
            contracts={serializedContracts}
            loadError={loadError}
          />
        </div>
      </div>
    </div>
  );
}
