"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile, homePathForRole } from "@/lib/auth/session";

export type AuthActionState = { error?: string; message?: string } | null;

const emailSchema = z.string().trim().min(1, "Email is required").email("Enter a valid email");
const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

const signUpSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required"),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(["buyer", "developer_admin"]),
  orgName: z.string().trim().optional(),
});

export async function signUp(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
    orgName: formData.get("orgName") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { fullName, email, password, role, orgName } = parsed.data;

  let orgId: string | undefined;
  if (role === "developer_admin") {
    if (!orgName) {
      return { error: "Organization / builder name is required for a developer account" };
    }
    // Uses the service-role client because there is no session yet.
    const admin = createAdminClient();
    const { data: org, error: orgError } = await admin
      .from("orgs")
      .insert({ name: orgName })
      .select("id")
      .single();
    if (orgError || !org) {
      return { error: orgError?.message ?? "Could not create organization" };
    }
    orgId = org.id;
  }

  // role/org_id are deliberately NOT passed as signUp metadata: that field
  // (raw_user_meta_data) is set the same way whether it comes from this
  // trusted server action or from anyone calling the *public*
  // supabase.auth.signUp() directly with their own options.data — the
  // database trigger that creates the profile row can't tell those apart.
  // Every new profile starts as a plain buyer with no org; granting
  // developer_admin + attaching the org happens below, via an explicit
  // service-role update gated on this action's own server-side logic
  // (i.e. "this request really did just create a fresh org").
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) return { error: error.message };
  if (!data.user) return { error: "Could not create account" };

  if (role === "developer_admin" && orgId) {
    const admin = createAdminClient();
    const { error: promoteError } = await admin
      .from("profiles")
      .update({ role: "developer_admin", org_id: orgId })
      .eq("id", data.user.id);
    if (promoteError) {
      return {
        error:
          "Account created but could not be linked to your organization. Please contact support.",
      };
    }
  }

  if (!data.session) {
    return {
      message: "Account created. Check your email to confirm it before signing in.",
    };
  }

  redirect(homePathForRole(role));
}

const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export async function signIn(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Incorrect email or password" };

  const profile = await getCurrentProfile();
  redirect(homePathForRole(profile?.role ?? "buyer"));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
