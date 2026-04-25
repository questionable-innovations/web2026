import { NewContractForm } from "@/features/contracts/components/NewContractForm";

export default function NewContractPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold">New contract</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Upload the PDF, set the deposit, sign first.
      </p>
      <div className="mt-8">
        <NewContractForm />
      </div>
    </main>
  );
}
