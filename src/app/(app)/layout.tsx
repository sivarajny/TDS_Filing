import Link from "next/link";
import { requireProfile, homePathForRole } from "@/lib/auth/session";
import { signOut } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireProfile();
  const home = homePathForRole(profile.role);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href={home} className="text-base font-semibold text-slate-900">
            TDS Property Tracker
          </Link>

          <nav className="flex flex-wrap items-center gap-1 text-sm">
            {profile.role === "buyer" ? (
              <Link
                href="/dashboard"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                My Transactions
              </Link>
            ) : (
              <Link
                href="/admin"
                className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
              >
                Dashboard
              </Link>
            )}
            <Link
              href="/transactions/new"
              className="rounded-md px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-100"
            >
              New Transaction
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">
              {profile.full_name ?? profile.email}
            </span>
            <form action={signOut}>
              <Button type="submit" variant="secondary" className="text-xs">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
