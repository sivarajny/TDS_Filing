import type { Metadata } from "next";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NewTransactionForm } from "./new-transaction-form";

export const metadata: Metadata = { title: "New transaction — TDS Property Tracker" };

export default async function NewTransactionPage() {
  const profile = await requireProfile();

  let buyers: Array<{ id: string; full_name: string | null; email: string }> = [];
  let projects: Array<{ id: string; name: string }> = [];

  if (profile.role === "developer_admin" && profile.org_id) {
    const supabase = await createClient();
    const [buyersRes, projectsRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("org_id", profile.org_id)
        .eq("role", "buyer")
        .order("full_name"),
      supabase.from("projects").select("id, name").eq("org_id", profile.org_id).order("name"),
    ]);
    buyers = buyersRes.data ?? [];
    projects = projectsRes.data ?? [];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">New transaction</h1>
        <p className="mt-1 text-sm text-slate-600">
          Set up the property, buyer/seller details, and payment milestone schedule. TDS is
          calculated automatically per milestone.
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <NewTransactionForm
          role={profile.role}
          buyers={buyers}
          projects={projects}
          defaultBuyerName={profile.role === "buyer" ? (profile.full_name ?? undefined) : undefined}
        />
      </div>
    </div>
  );
}
