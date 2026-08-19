"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { computeMilestoneTds } from "@/lib/tds/apply";

export type MilestoneActionState = { error?: string } | null;

const recordPaymentSchema = z.object({
  milestoneId: z.string().uuid(),
  transactionId: z.string().uuid(),
  paymentDate: z.string().min(1, "Payment date is required"),
});

/**
 * Marks a milestone as paid and recalculates its TDS against the rules
 * version active on the actual payment date — this is also what starts the
 * 30-day statutory filing clock (filing_deadline is a generated column off
 * payment_date).
 */
export async function recordMilestonePayment(
  _prevState: MilestoneActionState,
  formData: FormData,
): Promise<MilestoneActionState> {
  const parsed = recordPaymentSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    transactionId: formData.get("transactionId"),
    paymentDate: formData.get("paymentDate"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { milestoneId, transactionId, paymentDate } = parsed.data;

  const supabase = await createClient();

  const [{ data: milestone, error: milestoneError }, { data: transaction, error: txError }] =
    await Promise.all([
      supabase.from("milestones").select("amount").eq("id", milestoneId).single(),
      supabase
        .from("transactions")
        .select("property_value, seller_residential_status, seller_pan")
        .eq("id", transactionId)
        .single(),
    ]);
  if (milestoneError || !milestone) return { error: "Milestone not found" };
  if (txError || !transaction) return { error: "Transaction not found" };

  const { data: ldc } = await supabase
    .from("lower_deduction_certificates")
    .select("status, certified_rate, valid_from, valid_to")
    .eq("transaction_id", transactionId)
    .maybeSingle();

  const calc = await computeMilestoneTds(supabase, {
    milestoneAmount: milestone.amount,
    propertyValue: transaction.property_value,
    sellerResidentialStatus: transaction.seller_residential_status,
    sellerHasPan: Boolean(transaction.seller_pan),
    paymentDate,
    lowerDeductionCertificate: ldc
      ? {
          status: ldc.status,
          certifiedRate: ldc.certified_rate,
          validFrom: ldc.valid_from,
          validTo: ldc.valid_to,
        }
      : null,
  });

  const { error: updateError } = await supabase
    .from("milestones")
    .update({
      payment_date: paymentDate,
      rules_version_id: calc.rulesVersionId,
      tds_rate: calc.tdsRatePercent,
      tds_amount: calc.tdsAmount,
      calculation: calc.calculation,
    })
    .eq("id", milestoneId);

  if (updateError) return { error: updateError.message };

  revalidatePath(`/transactions/${transactionId}`);
  return null;
}

const markFiledSchema = z.object({
  milestoneId: z.string().uuid(),
  transactionId: z.string().uuid(),
  challanNumber: z.string().trim().min(1, "Challan/reference number is required"),
  acknowledgmentNumber: z.string().trim().optional(),
});

/** Records that the buyer has completed the actual portal filing for this milestone. */
export async function markMilestoneFiled(
  _prevState: MilestoneActionState,
  formData: FormData,
): Promise<MilestoneActionState> {
  const parsed = markFiledSchema.safeParse({
    milestoneId: formData.get("milestoneId"),
    transactionId: formData.get("transactionId"),
    challanNumber: formData.get("challanNumber"),
    acknowledgmentNumber: formData.get("acknowledgmentNumber") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { milestoneId, transactionId, challanNumber, acknowledgmentNumber } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase
    .from("milestones")
    .update({
      filed_at: new Date().toISOString(),
      challan_number: challanNumber,
      acknowledgment_number: acknowledgmentNumber ?? null,
    })
    .eq("id", milestoneId);

  if (error) return { error: error.message };

  revalidatePath(`/transactions/${transactionId}`);
  return null;
}
