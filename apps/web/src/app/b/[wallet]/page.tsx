import { ReputationCard } from "@/features/reputation/components/ReputationCard";
import { PageShell } from "@/components/AppShell";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  // Path may be either a 0x address or a URL-encoded ENS name; the reputation
  // API normalises both. Pass the decoded form straight through so the URL
  // shown in the address bar (`/b/dealseal.eth`) matches what the API resolves.
  const decoded = decodeURIComponent(wallet);
  return (
    <PageShell active="reputation" wallet={decoded}>
      <ReputationCard wallet={decoded} />
    </PageShell>
  );
}
