"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/lib/auth/session";

export type AdvisorActionState = { error?: string } | null;

const inviteAdvisorSchema = z.object({
  advisorEmail: z.string().trim().email("Enter a valid email"),
  advisorName: z.string().trim().optional(),
});

/** Grants a CA read-only access to every transaction the calling buyer owns. */
export async function inviteAdvisor(
  _prevState: AdvisorActionState,
  formData: FormData,
): Promise<AdvisorActionState> {
  const buyer = await requireRole("buyer");

  const parsed = inviteAdvisorSchema.safeParse({
    advisorEmail: formData.get("advisorEmail"),
    advisorName: formData.get("advisorName") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { advisorEmail, advisorName } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("profiles")
    .select("id")
    .eq("email", advisorEmail)
    .maybeSingle();

  let advisorId: string;
  if (existing) {
    advisorId = existing.id;
  } else {
    // New account: default role from the trigger is 'buyer' (see the
    // signup-privilege-escalation fix) — promote it to 'ca' explicitly,
    // authorized by this action's own requireRole('buyer') check above.
    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      advisorEmail,
      { data: { full_name: advisorName ?? advisorEmail } },
    );
    if (inviteError || !invited.user) {
      return { error: inviteError?.message ?? "Could not invite advisor" };
    }
    const { error: promoteError } = await admin
      .from("profiles")
      .update({ role: "ca" })
      .eq("id", invited.user.id);
    if (promoteError) return { error: promoteError.message };
    advisorId = invited.user.id;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("advisor_links")
    .insert({ buyer_id: buyer.id, advisor_id: advisorId });
  if (error) {
    if (error.code === "23505") return { error: "This advisor already has access" };
    return { error: error.message };
  }

  revalidatePath("/dashboard");
  return null;
}

const removeAdvisorSchema = z.object({ linkId: z.string().uuid() });

export async function removeAdvisor(
  _prevState: AdvisorActionState,
  formData: FormData,
): Promise<AdvisorActionState> {
  await requireRole("buyer");
  const parsed = removeAdvisorSchema.safeParse({ linkId: formData.get("linkId") });
  if (!parsed.success) return { error: "Invalid input" };

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("advisor_links")
    .delete({ count: "exact" })
    .eq("id", parsed.data.linkId);
  if (error) return { error: error.message };
  if (!count) return { error: "Advisor link not found" };

  revalidatePath("/dashboard");
  return null;
}
