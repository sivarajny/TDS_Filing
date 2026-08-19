import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTransactionsForAdvisor } from "@/lib/transactions/queries";
import { TransactionsTable } from "@/components/transactions-table";
import { DisclaimerBanner } from "@/components/disclaimer-banner";

export default async function AdvisorDashboardPage() {
  await requireRole("ca");
  const supabase = await createClient();
  const summaries = await listTransactionsForAdvisor(supabase);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Client transactions</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only access, granted by each client. You can view figures and download the pre-fill
          package, but cannot record payments, mark filings, or upload documents.
        </p>
      </div>
      <DisclaimerBanner compact />
      <TransactionsTable summaries={summaries} showBuyer />
    </div>
  );
}
