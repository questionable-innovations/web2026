import { CounterpartySigning } from "@/features/signing/components/CounterpartySigning";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <CounterpartySigning escrowAddress={address} />
    </main>
  );
}
