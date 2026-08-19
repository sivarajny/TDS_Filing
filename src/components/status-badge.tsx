import type { ComplianceStatus } from "@/types/database.types";
import { clsx } from "@/lib/utils";

const STYLES: Record<ComplianceStatus, string> = {
  upcoming: "bg-slate-100 text-slate-700",
  due_soon: "bg-amber-100 text-amber-800",
  overdue: "bg-red-100 text-red-800",
  filed: "bg-emerald-100 text-emerald-800",
};

const LABELS: Record<ComplianceStatus, string> = {
  upcoming: "Upcoming",
  due_soon: "Due soon",
  overdue: "Overdue",
  filed: "Filed",
};

export function StatusBadge({ status }: { status: ComplianceStatus }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STYLES[status],
      )}
    >
      {LABELS[status]}
    </span>
  );
}
