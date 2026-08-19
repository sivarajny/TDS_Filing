import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile, homePathForRole } from "@/lib/auth/session";
import { Button } from "@/components/ui/button";
import { DisclaimerBanner } from "@/components/disclaimer-banner";

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) redirect(homePathForRole(profile.role));

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="text-base font-semibold text-slate-900">TDS Property Tracker</span>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Never miss a 194-IA TDS filing deadline again
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Track TDS obligations across every payment milestone of your property purchase —
            calculated automatically, reminded on time, and packaged for the government portal so
            you file it yourself, accurately and on schedule.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup">
              <Button className="px-6 py-3 text-base">Create free account</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" className="px-6 py-3 text-base">
                Sign in
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          <FeatureCard
            title="Milestone-synced calculations"
            body="TDS is calculated per payment milestone against a versioned rules table — auditable even after rates change."
          />
          <FeatureCard
            title="Deadline reminders"
            body="Email reminders at T-14, T-7, and T-1 before each 30-day statutory filing deadline."
          />
          <FeatureCard
            title="Portal-ready pre-fill"
            body="A downloadable summary with every field you need to enter on the e-filing portal yourself."
          />
        </div>

        <div className="mt-12">
          <DisclaimerBanner />
        </div>
      </main>
    </div>
  );
}

function FeatureCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5">
      <h3 className="font-medium text-slate-900">{title}</h3>
      <p className="mt-1.5 text-sm text-slate-600">{body}</p>
    </div>
  );
}
