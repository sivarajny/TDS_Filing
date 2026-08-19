"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LdcActionState = { error?: string } | null;

const updateLdcSchema = z.object({
  transactionId: z.string().uuid(),
  status: z.enum(["not_applicable", "applied", "approved", "rejected", "expired"]),
  certificateNumber: z.string().trim().optional(),
  certifiedRate: z.coerce.number().min(0).max(100).optional(),
  validFrom: z.string().trim().optional(),
  validTo: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

/**
 * Updates the Form 13 Lower/Nil Deduction Certificate status for a
 * transaction. An "approved" certificate with a certified rate overrides
 * the standard NRI TDS computation on any milestone paid within its
 * validity window (see src/lib/tds/calculator.ts).
 */
export async function updateLowerDeductionCertificate(
  _prevState: LdcActionState,
  formData: FormData,
): Promise<LdcActionState> {
  const parsed = updateLdcSchema.safeParse({
    transactionId: formData.get("transactionId"),
    status: formData.get("status"),
    certificateNumber: formData.get("certificateNumber") || undefined,
    certifiedRate: formData.get("certifiedRate") || undefined,
    validFrom: formData.get("validFrom") || undefined,
    validTo: formData.get("validTo") || undefined,
    notes: formData.get("notes") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { transactionId, status, certificateNumber, certifiedRate, validFrom, validTo, notes } =
    parsed.data;

  if (status === "approved" && certifiedRate === undefined) {
    return { error: "Enter the certified rate for an approved certificate" };
  }

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("lower_deduction_certificates")
    .update(
      {
        status,
        certificate_number: certificateNumber ?? null,
        certified_rate: certifiedRate ?? null,
        valid_from: validFrom ?? null,
        valid_to: validTo ?? null,
        notes: notes ?? null,
      },
      { count: "exact" },
    )
    .eq("transaction_id", transactionId);

  if (error) return { error: error.message };
  // An RLS-blocked update matches 0 rows without erroring — surface that
  // as a real error instead of a false "saved" response.
  if (!count) return { error: "Transaction not found or you don't have access to it" };

  revalidatePath(`/transactions/${transactionId}`);
  return null;
}
