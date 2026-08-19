"use client";

import { useActionState, useState } from "react";
import type { Database, LowerDeductionStatus } from "@/types/database.types";
import { updateLowerDeductionCertificate } from "@/lib/ldc/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { clsx } from "@/lib/utils";

type Ldc = Database["public"]["Tables"]["lower_deduction_certificates"]["Row"];

const STATUS_LABELS: Record<LowerDeductionStatus, string> = {
  not_applicable: "Not applicable",
  applied: "Applied — awaiting AO order",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
};

const STATUS_STYLES: Record<LowerDeductionStatus, string> = {
  not_applicable: "bg-slate-100 text-slate-700",
  applied: "bg-blue-100 text-blue-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-amber-100 text-amber-800",
};

export function LdcPanel({
  transactionId,
  certificate,
  readOnly = false,
}: {
  transactionId: string;
  certificate: Ldc | null;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const status = certificate?.status ?? "not_applicable";

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Form 13 — Lower/Nil Deduction Certificate
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            An approved certificate overrides the standard NRI TDS rate for milestones paid
            within its validity window.
          </p>
        </div>
        <span
          className={clsx(
            "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
            STATUS_STYLES[status],
          )}
        >
          {STATUS_LABELS[status]}
        </span>
      </div>

      {certificate?.status === "approved" ? (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-slate-500">Certificate no.</dt>
            <dd className="font-medium text-slate-900">{certificate.certificate_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Certified rate</dt>
            <dd className="font-medium text-slate-900">{certificate.certified_rate}%</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Valid from</dt>
            <dd className="font-medium text-slate-900">{certificate.valid_from ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Valid to</dt>
            <dd className="font-medium text-slate-900">{certificate.valid_to ?? "—"}</dd>
          </div>
        </dl>
      ) : null}

      {!readOnly ? (
        <div className="mt-3">
          <Button variant="secondary" onClick={() => setEditing((v) => !v)}>
            {editing ? "Cancel" : "Update status"}
          </Button>
        </div>
      ) : null}

      {!readOnly && editing ? (
        <LdcForm transactionId={transactionId} certificate={certificate} />
      ) : null}
    </div>
  );
}

function LdcForm({
  transactionId,
  certificate,
}: {
  transactionId: string;
  certificate: Ldc | null;
}) {
  const [state, formAction, pending] = useActionState(updateLowerDeductionCertificate, null);
  const [status, setStatus] = useState<LowerDeductionStatus>(
    certificate?.status ?? "not_applicable",
  );

  return (
    <form action={formAction} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <input type="hidden" name="transactionId" value={transactionId} />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <Field label="Status" htmlFor="ldc-status">
        <select
          id="ldc-status"
          name="status"
          value={status}
          onChange={(e) => setStatus(e.target.value as LowerDeductionStatus)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </Field>

      {status === "approved" || status === "applied" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Certificate number" htmlFor="certificateNumber">
            <Input
              id="certificateNumber"
              name="certificateNumber"
              defaultValue={certificate?.certificate_number ?? ""}
            />
          </Field>
          <Field label="Certified rate (%)" htmlFor="certifiedRate">
            <Input
              id="certifiedRate"
              name="certifiedRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={certificate?.certified_rate ?? ""}
            />
          </Field>
          <Field label="Valid from" htmlFor="validFrom">
            <Input
              id="validFrom"
              name="validFrom"
              type="date"
              defaultValue={certificate?.valid_from ?? ""}
            />
          </Field>
          <Field label="Valid to" htmlFor="validTo">
            <Input
              id="validTo"
              name="validTo"
              type="date"
              defaultValue={certificate?.valid_to ?? ""}
            />
          </Field>
        </div>
      ) : null}

      <Field label="Notes (optional)" htmlFor="notes">
        <Input id="notes" name="notes" defaultValue={certificate?.notes ?? ""} />
      </Field>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </form>
  );
}
