import { CounterpartySigning } from "@/features/signing/components/CounterpartySigning";

export default async function ContractPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return <CounterpartySigning escrowAddress={address} />;
}
