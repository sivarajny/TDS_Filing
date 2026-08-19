import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppSectionNotFound() {
  return (
    <div className="mx-auto max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">Not found</h1>
      <p className="text-sm text-slate-600">
        This page doesn&apos;t exist, has been removed, or you don&apos;t have access to it.
      </p>
      <Link href="/">
        <Button>Go home</Button>
      </Link>
    </div>
  );
}
