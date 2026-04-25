import { LookupPanel } from "@/features/reputation/components/LookupPanel";
import { PageShell } from "@/components/AppShell";

export default function ReputationLookupPage() {
  return (
    <PageShell active="reputation">
      <LookupPanel />
    </PageShell>
  );
}
