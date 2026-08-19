import { notFound } from "next/navigation";
import Link from "next/link";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getMilestoneForPrefill } from "@/lib/transactions/queries";
import { getFinancialYear } from "@/lib/tds/financial-year";
import { formatDate, formatInr } from "@/lib/format";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { PrefillActions, type PrefillSection } from "./prefill-actions";

export default async function PrefillPage(
  props: PageProps<"/transactions/[id]/milestones/[milestoneId]/prefill">,
) {
  const { id, milestoneId } = await props.params;
  await requireProfile();

  const supabase = await createClient();
  const detail = await getMilestoneForPrefill(supabase, milestoneId);
  if (!detail || detail.transaction.id !== id) notFound();

  const { milestone, transaction, rulesVersion } = detail;
  const isNri = transaction.seller_residential_status === "nri";
  const asOfDate = milestone.payment_date ?? milestone.due_date;
  const { fy, ay } = getFinancialYear(asOfDate);
  const formType = rulesVersion?.form_type ?? (asOfDate >= "2026-04-01" ? "141" : "26QB");
  const calc = milestone.calculation;

  const sections: PrefillSection[] = [
    {
      section: "Filing",
      rows: [
        { label: "Form", value: formType === "141" ? "Form 141 (unified)" : "Form 26QB" },
        { label: "Rules version used", value: rulesVersion?.version_label ?? "—" },
        { label: "Financial year", value: fy },
        { label: "Assessment year", value: ay },
        { label: "Statutory filing deadline", value: formatDate(milestone.filing_deadline) },
      ],
    },
    {
      section: "Buyer (Transferee)",
      rows: [
        { label: "Name", value: transaction.buyer_name },
        { label: "PAN", value: transaction.buyer_pan },
        { label: "Address", value: transaction.buyer_address ?? transaction.property_address },
      ],
    },
    {
      section: "Seller (Transferor)",
      rows: [
        { label: "Name", value: transaction.seller_name },
        { label: "PAN", value: transaction.seller_pan ?? "Not available (Sec 206AA rate applied)" },
        { label: "Residential status", value: isNri ? "Non-Resident" : "Resident" },
        { label: "Address", value: transaction.seller_address ?? "—" },
      ],
    },
    {
      section: "Property",
      rows: [
        { label: "Address", value: transaction.property_address },
        { label: "Unit / flat number", value: transaction.unit_number ?? "—" },
        { label: "Total consideration", value: formatInr(transaction.property_value) },
      ],
    },
    {
      section: "This payment",
      rows: [
        { label: "Milestone", value: `${milestone.sequence_no}. ${milestone.description}` },
        { label: "Amount paid / credited", value: formatInr(milestone.amount) },
        {
          label: "Date of payment / credit",
          value: milestone.payment_date ? formatDate(milestone.payment_date) : "Not yet recorded",
        },
        { label: "TDS rate applied", value: milestone.tds_rate !== null ? `${milestone.tds_rate}%` : "—" },
        {
          label: "TDS amount to deposit",
          value: milestone.tds_amount !== null ? formatInr(milestone.tds_amount) : "—",
        },
      ],
    },
  ];

  if (calc?.usedLowerDeductionCertificate) {
    sections.push({
      section: "Lower/Nil Deduction Certificate",
      rows: [
        { label: "Applied", value: "Yes — certified rate used in place of standard computation" },
        { label: "Certified rate", value: `${calc.baseRatePercent}%` },
      ],
    });
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="no-print">
        <Link href={`/transactions/${id}`} className="text-sm text-indigo-600 hover:text-indigo-500">
          ← Back to transaction
        </Link>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-slate-900">Portal filing pre-fill package</h1>
        <p className="mt-1 text-sm text-slate-600">
          Copy these figures into the Income Tax e-filing portal yourself — this app does not
          submit anything on your behalf.
        </p>
      </div>

      <DisclaimerBanner />

      {!milestone.payment_date ? (
        <div className="no-print rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Payment date has not been recorded for this milestone yet — figures below are an
          estimate as of the due date. Record the actual payment date on the transaction page for
          final figures.
        </div>
      ) : null}

      <PrefillActions
        sections={sections}
        fileNamePrefix={`tds-prefill-${transaction.property_address.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-m${milestone.sequence_no}`}
      />

      <div className="space-y-4">
        {sections.map((s) => (
          <div key={s.section} className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-slate-900">{s.section}</h2>
            <dl className="mt-2 divide-y divide-slate-100">
              {s.rows.map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-1.5 text-sm">
                  <dt className="text-slate-500">{row.label}</dt>
                  <dd className="text-right font-medium text-slate-900">{row.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>

      {calc?.notes.length ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
          <p className="font-medium text-slate-700">Calculation notes</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {calc.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
