import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export async function listAdvisorsForBuyer(supabase: SupabaseClient<Database>, buyerId: string) {
  const { data: links, error } = await supabase
    .from("advisor_links")
    .select("*")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!links || links.length === 0) return [];

  const { data: advisors } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in(
      "id",
      links.map((l) => l.advisor_id),
    );

  return links.map((link) => ({
    link,
    advisor: advisors?.find((a) => a.id === link.advisor_id) ?? null,
  }));
}
