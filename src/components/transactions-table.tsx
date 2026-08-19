import Link from "next/link";
import type { TransactionSummary } from "@/lib/transactions/queries";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatInr } from "@/lib/format";

export function TransactionsTable({
  summaries,
  showBuyer = false,
}: {
  summaries: TransactionSummary[];
  showBuyer?: boolean;
}) {
  if (summaries.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        No transactions yet.{" "}
        <Link href="/transactions/new" className="font-medium text-indigo-600 hover:text-indigo-500">
          Create one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <Th>Property</Th>
            {showBuyer ? <Th>Buyer</Th> : null}
            <Th>Status</Th>
            <Th>Milestones</Th>
            <Th>Total TDS</Th>
            <Th>Next deadline</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {summaries.map(({ transaction, milestoneCount, totalTds, overallStatus, nextDeadline }) => (
            <tr key={transaction.id} className="hover:bg-slate-50">
              <td className="whitespace-nowrap px-4 py-3">
                <Link
                  href={`/transactions/${transaction.id}`}
                  className="font-medium text-slate-900 hover:text-indigo-600"
                >
                  {transaction.property_address}
                </Link>
                {transaction.seller_residential_status === "nri" ? (
                  <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-800">
                    NRI
                  </span>
                ) : null}
              </td>
              {showBuyer ? (
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {transaction.buyer_name}
                </td>
              ) : null}
              <td className="whitespace-nowrap px-4 py-3">
                <StatusBadge status={overallStatus} />
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{milestoneCount}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatInr(totalTds)}</td>
              <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                {nextDeadline ? formatDate(nextDeadline) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}
