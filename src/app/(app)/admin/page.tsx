import { requireRole } from "@/lib/auth/session";

export default async function AdminDashboardPage() {
  await requireRole("developer_admin");
  return <p className="text-slate-600">Your organization&apos;s transactions will appear here.</p>;
}
