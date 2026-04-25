import { ReputationCard } from "@/features/reputation/components/ReputationCard";

export default async function ReputationPage({
  params,
}: {
  params: Promise<{ wallet: string }>;
}) {
  const { wallet } = await params;
  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <ReputationCard wallet={wallet} />
    </main>
  );
}
