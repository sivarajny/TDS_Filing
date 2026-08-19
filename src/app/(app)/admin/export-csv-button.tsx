"use client";

import { Button } from "@/components/ui/button";
import type { TransactionSummary } from "@/lib/transactions/queries";

export function ExportCsvButton({ summaries }: { summaries: TransactionSummary[] }) {
  function handleExport() {
    const header = [
      "Property",
      "Buyer",
      "Buyer PAN",
      "Seller",
      "Seller residential status",
      "Status",
      "Milestones",
      "Total TDS",
      "Next deadline",
    ];
    const rows = summaries.map(({ transaction, milestoneCount, totalTds, overallStatus, nextDeadline }) => [
      transaction.property_address,
      transaction.buyer_name,
      transaction.buyer_pan,
      transaction.seller_name,
      transaction.seller_residential_status,
      overallStatus,
      String(milestoneCount),
      String(totalTds),
      nextDeadline ?? "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(csvEscape).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tds-compliance-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" onClick={handleExport}>
      Export CSV
    </Button>
  );
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
