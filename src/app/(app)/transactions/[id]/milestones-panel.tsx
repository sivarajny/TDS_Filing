"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Database } from "@/types/database.types";
import { recordMilestonePayment, markMilestoneFiled } from "@/lib/milestones/actions";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { formatDate, formatInr } from "@/lib/format";

type MilestoneRow = Database["public"]["Views"]["v_milestones_with_status"]["Row"];

export function MilestonesPanel({
  transactionId,
  milestones,
  readOnly = false,
}: {
  transactionId: string;
  milestones: MilestoneRow[];
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">Payment milestones</h2>
      <div className="mt-3 space-y-3">
        {milestones.map((m) => (
          <MilestoneCard key={m.id} milestone={m} transactionId={transactionId} readOnly={readOnly} />
        ))}
      </div>
    </div>
  );
}

function MilestoneCard({
  milestone,
  transactionId,
  readOnly,
}: {
  milestone: MilestoneRow;
  transactionId: string;
  readOnly: boolean;
}) {
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showFiledForm, setShowFiledForm] = useState(false);

  const isPaid = Boolean(milestone.payment_date);
  const isFiled = Boolean(milestone.filed_at);

  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium text-slate-900">
            {milestone.sequence_no}. {milestone.description}
          </p>
          <p className="text-sm text-slate-500">Due {formatDate(milestone.due_date)}</p>
        </div>
        <StatusBadge status={milestone.compliance_status} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
        <Metric label="Amount" value={formatInr(milestone.amount)} />
        <Metric
          label="TDS rate"
          value={milestone.tds_rate !== null ? `${milestone.tds_rate}%` : "—"}
        />
        <Metric
          label="TDS amount"
          value={milestone.tds_amount !== null ? formatInr(milestone.tds_amount) : "—"}
        />
        <Metric label="Filing deadline" value={formatDate(milestone.filing_deadline)} />
      </dl>

      {isPaid ? (
        <p className="mt-2 text-xs text-slate-500">Paid on {formatDate(milestone.payment_date)}</p>
      ) : null}

      {isFiled ? (
        <p className="mt-2 text-xs text-emerald-700">
          Filed — challan/reference {milestone.challan_number}
          {milestone.acknowledgment_number ? ` · ack ${milestone.acknowledgment_number}` : ""}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {!isPaid && !readOnly ? (
          <Button variant="secondary" onClick={() => setShowPaymentForm((v) => !v)}>
            Record payment
          </Button>
        ) : null}
        {isPaid && !isFiled ? (
          <>
            <Link href={`/transactions/${transactionId}/milestones/${milestone.id}/prefill`}>
              <Button variant="secondary">Get pre-fill package</Button>
            </Link>
            {!readOnly ? (
              <Button variant="secondary" onClick={() => setShowFiledForm((v) => !v)}>
                Mark as filed
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {!readOnly && !isPaid && showPaymentForm ? (
        <PaymentForm milestoneId={milestone.id} transactionId={transactionId} />
      ) : null}
      {!readOnly && isPaid && !isFiled && showFiledForm ? (
        <FiledForm milestoneId={milestone.id} transactionId={transactionId} />
      ) : null}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900">{value}</dd>
    </div>
  );
}

function PaymentForm({
  milestoneId,
  transactionId,
}: {
  milestoneId: string;
  transactionId: string;
}) {
  const [state, formAction, pending] = useActionState(recordMilestonePayment, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <div>
        <label htmlFor={`payment-date-${milestoneId}`} className="block text-xs text-slate-500">
          Actual payment date
        </label>
        <Input id={`payment-date-${milestoneId}`} name="paymentDate" type="date" required />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}

function FiledForm({
  milestoneId,
  transactionId,
}: {
  milestoneId: string;
  transactionId: string;
}) {
  const [state, formAction, pending] = useActionState(markMilestoneFiled, null);

  return (
    <form action={formAction} className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
      <input type="hidden" name="milestoneId" value={milestoneId} />
      <input type="hidden" name="transactionId" value={transactionId} />
      <div>
        <label htmlFor={`challan-${milestoneId}`} className="block text-xs text-slate-500">
          Challan / reference number
        </label>
        <Input id={`challan-${milestoneId}`} name="challanNumber" required />
      </div>
      <div>
        <label htmlFor={`ack-${milestoneId}`} className="block text-xs text-slate-500">
          Acknowledgment number (optional)
        </label>
        <Input id={`ack-${milestoneId}`} name="acknowledgmentNumber" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </Button>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
    </form>
  );
}
