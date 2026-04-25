import { NewContractForm } from "@/features/contracts/components/NewContractForm";
import { PageShell } from "@/components/AppShell";

export default function NewContractPage() {
  return (
    <PageShell active="create">
      <div className="px-9 py-8">
        <NewContractForm />
      </div>
    </PageShell>
  );
}
