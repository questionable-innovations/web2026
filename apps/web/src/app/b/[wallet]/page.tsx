import { ReputationCard } from "@/features/reputation/components/ReputationCard";
import { PageShell } from "@/components/AppShell";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return (
    <PageShell active="reputation" wallet={wallet}>
      <ReputationCard wallet={wallet} />
    </PageShell>
  );
}
