import { requireRole } from "@/lib/auth/session";

export default async function DashboardPage() {
  await requireRole("buyer");
  return <p className="text-slate-600">Your transactions will appear here.</p>;
}
