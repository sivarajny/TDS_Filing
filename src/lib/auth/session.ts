import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database, UserRole } from "@/types/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

/** Redirects to /login when no session exists. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** Redirects to the caller's own home when signed in with the wrong role. */
export async function requireRole(role: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (profile.role !== role) {
    redirect(profile.role === "developer_admin" ? "/admin" : "/dashboard");
  }
  return profile;
}

export function homePathForRole(role: UserRole): string {
  return role === "developer_admin" ? "/admin" : "/dashboard";
}
