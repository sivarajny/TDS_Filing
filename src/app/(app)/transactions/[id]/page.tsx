import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getTransactionDetail } from "@/lib/transactions/queries";
import { DisclaimerBanner } from "@/components/disclaimer-banner";
import { formatInr } from "@/lib/format";
import { MilestonesPanel } from "./milestones-panel";
import { LdcPanel } from "./ldc-panel";
import { DocumentsPanel } from "./documents-panel";

export default async function TransactionDetailPage(props: PageProps<"/transactions/[id]">) {
  const { id } = await props.params;
  const profile = await requireProfile();

  const supabase = await createClient();
  const detail = await getTransactionDetail(supabase, id);
  if (!detail) notFound();

  const { transaction, milestones, lowerDeductionCertificate, documents } = detail;
  const isNri = transaction.seller_residential_status === "nri";
  // CAs get RLS-enforced read-only access (see advisor_links) — the DB
  // already blocks any write, this just keeps the UI from offering buttons
  // that would only fail.
  const readOnly = profile.role === "ca";
  const totalMilestoneAmount = milestones.reduce((sum, m) => sum + m.amount, 0);
  const totalTds = milestones.reduce((sum, m) => sum + (m.tds_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{transaction.property_address}</h1>
          {transaction.unit_number ? (
            <p className="text-sm text-slate-500">Unit {transaction.unit_number}</p>
          ) : null}
        </div>
        {isNri ? (
          <span className="inline-flex items-center rounded-full bg-purple-100 px-3 py-1 text-xs font-medium text-purple-800">
            NRI seller
          </span>
        ) : null}
      </div>

      <DisclaimerBanner />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total consideration" value={formatInr(transaction.property_value)} />
        <SummaryCard label="Milestones scheduled" value={formatInr(totalMilestoneAmount)} />
        <SummaryCard label="Total TDS (est.)" value={formatInr(totalTds)} />
        <SummaryCard label="Milestones" value={String(milestones.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard title="Buyer">
          <InfoRow label="Name" value={transaction.buyer_name} />
          <InfoRow label="PAN" value={transaction.buyer_pan} mono />
          {transaction.buyer_address ? (
            <InfoRow label="Address" value={transaction.buyer_address} />
          ) : null}
        </InfoCard>
        <InfoCard title="Seller">
          <InfoRow label="Name" value={transaction.seller_name} />
          <InfoRow label="PAN" value={transaction.seller_pan ?? "Not provided"} mono />
          <InfoRow
            label="Residential status"
            value={isNri ? "Non-Resident Indian (NRI)" : "Resident"}
          />
          {transaction.seller_address ? (
            <InfoRow label="Address" value={transaction.seller_address} />
          ) : null}
        </InfoCard>
      </div>

      {isNri ? (
        <LdcPanel
          transactionId={transaction.id}
          certificate={lowerDeductionCertificate}
          readOnly={readOnly}
        />
      ) : null}

      <MilestonesPanel transactionId={transaction.id} milestones={milestones} readOnly={readOnly} />

      <DocumentsPanel
        transactionId={transaction.id}
        milestones={milestones}
        documents={documents}
        readOnly={readOnly}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <dl className="mt-3 space-y-2">{children}</dl>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? "font-mono text-slate-900" : "text-slate-900"}>{value}</dd>
    </div>
  );
}
