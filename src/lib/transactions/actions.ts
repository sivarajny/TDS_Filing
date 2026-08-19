"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireProfile } from "@/lib/auth/session";
import { computeMilestoneTds } from "@/lib/tds/apply";
import {
  buyerSelectionSchema,
  createTransactionSchema,
  type MilestoneInput,
} from "@/lib/transactions/schema";

export type TransactionActionState = { error?: string } | null;

export async function createTransaction(
  _prevState: TransactionActionState,
  formData: FormData,
): Promise<TransactionActionState> {
  const profile = await requireProfile();

  const parsed = createTransactionSchema.safeParse({
    projectId: emptyToUndefined(formData.get("projectId")),
    newProjectName: emptyToUndefined(formData.get("newProjectName")),
    propertyAddress: formData.get("propertyAddress"),
    unitNumber: emptyToUndefined(formData.get("unitNumber")),
    propertyValue: formData.get("propertyValue"),
    buyerName: formData.get("buyerName"),
    buyerPan: formData.get("buyerPan"),
    buyerAddress: emptyToUndefined(formData.get("buyerAddress")),
    sellerName: formData.get("sellerName"),
    sellerPan: formData.get("sellerPan") ?? "",
    sellerResidentialStatus: formData.get("sellerResidentialStatus"),
    sellerAddress: emptyToUndefined(formData.get("sellerAddress")),
    milestones: safeJsonParse(formData.get("milestonesJson")),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const input = parsed.data;
  const supabase = await createClient();

  let orgId: string | null = null;
  let buyerId: string;
  const createdBy = profile.id;

  if (profile.role === "developer_admin") {
    orgId = profile.org_id;
    if (!orgId) return { error: "Your developer account is not attached to an organization" };

    const buyerSelection = buyerSelectionSchema.safeParse({
      mode: formData.get("buyerMode"),
      buyerId: formData.get("buyerId") || undefined,
      buyerName: formData.get("inviteBuyerName") || undefined,
      buyerEmail: formData.get("inviteBuyerEmail") || undefined,
    });
    if (!buyerSelection.success) {
      return { error: buyerSelection.error.issues[0]?.message ?? "Select or invite a buyer" };
    }

    if (buyerSelection.data.mode === "existing") {
      const { data: buyerProfile, error: buyerError } = await supabase
        .from("profiles")
        .select("id, org_id")
        .eq("id", buyerSelection.data.buyerId)
        .single();
      if (buyerError || !buyerProfile || buyerProfile.org_id !== orgId) {
        return { error: "Selected buyer was not found in your organization" };
      }
      buyerId = buyerProfile.id;
    } else {
      const admin = createAdminClient();
      const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
        buyerSelection.data.buyerEmail,
        {
          data: {
            full_name: buyerSelection.data.buyerName,
            role: "buyer",
            org_id: orgId,
          },
        },
      );
      if (inviteError || !invited.user) {
        return { error: inviteError?.message ?? "Could not invite buyer" };
      }
      buyerId = invited.user.id;
    }
  } else {
    buyerId = profile.id;
    orgId = profile.org_id;
  }

  let projectId: string | null = input.projectId ?? null;
  if (!projectId && input.newProjectName && orgId) {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({ org_id: orgId, name: input.newProjectName })
      .select("id")
      .single();
    if (projectError || !project) {
      return { error: projectError?.message ?? "Could not create project" };
    }
    projectId = project.id;
  }

  const { data: transaction, error: txError } = await supabase
    .from("transactions")
    .insert({
      org_id: orgId,
      project_id: projectId,
      buyer_id: buyerId,
      created_by: createdBy,
      property_address: input.propertyAddress,
      unit_number: input.unitNumber ?? null,
      property_value: input.propertyValue,
      buyer_pan: input.buyerPan,
      buyer_name: input.buyerName,
      buyer_address: input.buyerAddress ?? null,
      seller_name: input.sellerName,
      seller_pan: input.sellerPan ?? null,
      seller_residential_status: input.sellerResidentialStatus,
      seller_address: input.sellerAddress ?? null,
    })
    .select("id")
    .single();

  if (txError || !transaction) {
    return { error: txError?.message ?? "Could not create transaction" };
  }

  const { error: ldcError } = await supabase.from("lower_deduction_certificates").insert({
    transaction_id: transaction.id,
    status: "not_applicable",
  });
  if (ldcError) return { error: ldcError.message };

  const milestoneError = await insertMilestones(supabase, {
    transactionId: transaction.id,
    propertyValue: input.propertyValue,
    sellerResidentialStatus: input.sellerResidentialStatus,
    sellerHasPan: Boolean(input.sellerPan),
    milestones: input.milestones,
  });
  if (milestoneError) return { error: milestoneError };

  redirect(`/transactions/${transaction.id}`);
}

async function insertMilestones(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    transactionId: string;
    propertyValue: number;
    sellerResidentialStatus: "resident" | "nri";
    sellerHasPan: boolean;
    milestones: MilestoneInput[];
  },
): Promise<string | null> {
  const rows = [];
  for (const [index, milestone] of params.milestones.entries()) {
    const calc = await computeMilestoneTds(supabase, {
      milestoneAmount: milestone.amount,
      propertyValue: params.propertyValue,
      sellerResidentialStatus: params.sellerResidentialStatus,
      sellerHasPan: params.sellerHasPan,
      paymentDate: null,
      lowerDeductionCertificate: null,
    });

    rows.push({
      transaction_id: params.transactionId,
      sequence_no: index + 1,
      description: milestone.description,
      amount: milestone.amount,
      due_date: milestone.dueDate,
      rules_version_id: calc.rulesVersionId,
      tds_rate: calc.tdsRatePercent,
      tds_amount: calc.tdsAmount,
      calculation: calc.calculation,
    });
  }

  const { error } = await supabase.from("milestones").insert(rows);
  return error?.message ?? null;
}

function emptyToUndefined(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  return value;
}

function safeJsonParse(value: FormDataEntryValue | null): unknown {
  if (typeof value !== "string") return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}
