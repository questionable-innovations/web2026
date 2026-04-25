import { PageShell } from "@/components/AppShell";
import { ReleaseFlow } from "@/features/release/components/ReleaseFlow";

export default async function ReleasePage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  return (
    <PageShell active="contracts">
      <ReleaseFlow escrowAddress={address} />
    </PageShell>
  );
}
