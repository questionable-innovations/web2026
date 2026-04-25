import { ReputationCard } from "@/features/reputation/components/ReputationCard";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return (
    <main className="min-h-screen bg-paper">
      <ReputationCard wallet={wallet} />
    </main>
  );
}
