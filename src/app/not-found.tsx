import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-3xl font-semibold text-slate-900">404</h1>
        <p className="text-sm text-slate-600">
          This page doesn&apos;t exist, or you don&apos;t have access to it.
        </p>
        <Link href="/">
          <Button>Go home</Button>
        </Link>
      </div>
    </div>
  );
}
