import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTransactionsForBuyer } from "@/lib/transactions/queries";
import { listAdvisorsForBuyer } from "@/lib/advisors/queries";
import { TransactionsTable } from "@/components/transactions-table";
import { Button } from "@/components/ui/button";
import { AdvisorsPanel } from "./advisors-panel";

export default async function DashboardPage() {
  const profile = await requireRole("buyer");
  const supabase = await createClient();
  const [summaries, advisors] = await Promise.all([
    listTransactionsForBuyer(supabase, profile.id),
    listAdvisorsForBuyer(supabase, profile.id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">My transactions</h1>
        <Link href="/transactions/new">
          <Button>+ New transaction</Button>
        </Link>
      </div>
      <TransactionsTable summaries={summaries} />
      <AdvisorsPanel advisors={advisors} />
    </div>
  );
}
