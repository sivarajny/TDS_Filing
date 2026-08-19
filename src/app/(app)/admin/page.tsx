import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { listTransactionsForOrg } from "@/lib/transactions/queries";
import { TransactionsTable } from "@/components/transactions-table";
import { Button } from "@/components/ui/button";
import { ExportCsvButton } from "./export-csv-button";

export default async function AdminDashboardPage() {
  const profile = await requireRole("developer_admin");

  if (!profile.org_id) {
    return <p className="text-slate-600">Your account is not attached to an organization.</p>;
  }

  const supabase = await createClient();
  const summaries = await listTransactionsForOrg(supabase, profile.org_id);

  const counts = {
    overdue: summaries.filter((s) => s.overallStatus === "overdue").length,
    dueSoon: summaries.filter((s) => s.overallStatus === "due_soon").length,
    filed: summaries.filter((s) => s.overallStatus === "filed").length,
    upcoming: summaries.filter((s) => s.overallStatus === "upcoming").length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Compliance dashboard</h1>
        <div className="flex gap-2">
          <ExportCsvButton summaries={summaries} />
          <Link href="/transactions/new">
            <Button>+ New transaction</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Overdue" value={counts.overdue} tone="text-red-700" />
        <StatCard label="Due soon" value={counts.dueSoon} tone="text-amber-700" />
        <StatCard label="Upcoming" value={counts.upcoming} tone="text-slate-700" />
        <StatCard label="Fully filed" value={counts.filed} tone="text-emerald-700" />
      </div>

      <TransactionsTable summaries={summaries} showBuyer />
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
