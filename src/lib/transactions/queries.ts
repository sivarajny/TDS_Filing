import type { SupabaseClient } from "@supabase/supabase-js";
import type { ComplianceStatus, Database } from "@/types/database.types";

const STATUS_RANK: Record<ComplianceStatus, number> = {
  filed: 0,
  upcoming: 1,
  due_soon: 2,
  overdue: 3,
};

/** The single most urgent status across a transaction's milestones (or "upcoming" if it has none yet). */
export function worstComplianceStatus(statuses: ComplianceStatus[]): ComplianceStatus {
  if (statuses.length === 0) return "upcoming";
  return statuses.reduce((worst, s) => (STATUS_RANK[s] > STATUS_RANK[worst] ? s : worst), statuses[0]);
}

export interface TransactionSummary {
  transaction: Database["public"]["Tables"]["transactions"]["Row"];
  milestoneCount: number;
  totalTds: number;
  overallStatus: ComplianceStatus;
  nextDeadline: string | null;
}

async function summarizeTransactions(
  supabase: SupabaseClient<Database>,
  transactions: Database["public"]["Tables"]["transactions"]["Row"][],
): Promise<TransactionSummary[]> {
  if (transactions.length === 0) return [];

  const { data: milestones, error } = await supabase
    .from("v_milestones_with_status")
    .select("*")
    .in(
      "transaction_id",
      transactions.map((t) => t.id),
    );
  if (error) throw error;

  return transactions.map((transaction) => {
    const own = (milestones ?? []).filter((m) => m.transaction_id === transaction.id);
    const unresolvedDeadlines = own
      .filter((m) => !m.filed_at && m.filing_deadline)
      .map((m) => m.filing_deadline as string)
      .sort();

    return {
      transaction,
      milestoneCount: own.length,
      totalTds: own.reduce((sum, m) => sum + (m.tds_amount ?? 0), 0),
      overallStatus: worstComplianceStatus(own.map((m) => m.compliance_status)),
      nextDeadline: unresolvedDeadlines[0] ?? null,
    };
  });
}

export async function listTransactionsForBuyer(
  supabase: SupabaseClient<Database>,
  buyerId: string,
): Promise<TransactionSummary[]> {
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return summarizeTransactions(supabase, transactions ?? []);
}

export async function listTransactionsForOrg(
  supabase: SupabaseClient<Database>,
  orgId: string,
): Promise<TransactionSummary[]> {
  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return summarizeTransactions(supabase, transactions ?? []);
}

export async function getTransactionDetail(
  supabase: SupabaseClient<Database>,
  transactionId: string,
) {
  const [txRes, milestonesRes, ldcRes, documentsRes] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", transactionId).maybeSingle(),
    supabase
      .from("v_milestones_with_status")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("sequence_no"),
    supabase
      .from("lower_deduction_certificates")
      .select("*")
      .eq("transaction_id", transactionId)
      .maybeSingle(),
    supabase
      .from("documents")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: false }),
  ]);

  if (txRes.error) throw txRes.error;
  if (!txRes.data) return null;

  return {
    transaction: txRes.data,
    milestones: milestonesRes.data ?? [],
    lowerDeductionCertificate: ldcRes.data ?? null,
    documents: documentsRes.data ?? [],
  };
}

export async function getMilestoneForPrefill(
  supabase: SupabaseClient<Database>,
  milestoneId: string,
) {
  const { data: milestone, error } = await supabase
    .from("v_milestones_with_status")
    .select("*")
    .eq("id", milestoneId)
    .maybeSingle();
  if (error) throw error;
  if (!milestone) return null;

  const [txRes, rulesRes] = await Promise.all([
    supabase.from("transactions").select("*").eq("id", milestone.transaction_id).maybeSingle(),
    milestone.rules_version_id
      ? supabase
          .from("tds_rules_versions")
          .select("version_label, form_type")
          .eq("id", milestone.rules_version_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (txRes.error) throw txRes.error;
  if (!txRes.data) return null;
  if (rulesRes.error) throw rulesRes.error;

  return { milestone, transaction: txRes.data, rulesVersion: rulesRes.data };
}
