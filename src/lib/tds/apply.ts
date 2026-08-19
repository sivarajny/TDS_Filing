import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ResidentialStatus } from "@/types/database.types";
import { getActiveTdsRulesVersion, todayIsoDate } from "@/lib/tds/rules";
import { calculateTds, type LowerDeductionCertificateInput } from "@/lib/tds/calculator";

export interface ComputeMilestoneTdsParams {
  milestoneAmount: number;
  propertyValue: number;
  sellerResidentialStatus: ResidentialStatus;
  sellerHasPan: boolean;
  /** Milestone's payment_date if known, else the calculation is done as-of today. */
  paymentDate: string | null;
  lowerDeductionCertificate?: LowerDeductionCertificateInput | null;
}

/**
 * Looks up the rules version active for this milestone's payment date (or
 * today, if unpaid) and runs the calculator against it. This is the single
 * entry point transaction/milestone server actions should call — it keeps
 * "which rules_version_id backs this number" consistent with "which rate
 * was actually used."
 */
export async function computeMilestoneTds(
  supabase: SupabaseClient<Database>,
  params: ComputeMilestoneTdsParams,
) {
  const asOfDate = params.paymentDate ?? todayIsoDate();
  const rulesVersion = await getActiveTdsRulesVersion(supabase, asOfDate);

  const result = calculateTds({
    milestoneAmount: params.milestoneAmount,
    propertyValue: params.propertyValue,
    sellerResidentialStatus: params.sellerResidentialStatus,
    sellerHasPan: params.sellerHasPan,
    paymentDate: params.paymentDate,
    lowerDeductionCertificate: params.lowerDeductionCertificate,
    rules: rulesVersion.rules,
    rulesVersionLabel: rulesVersion.version_label,
  });

  return {
    ...result,
    rulesVersionId: rulesVersion.id as string,
  };
}
