"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { signUp } from "@/lib/auth/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { clsx } from "@/lib/utils";

const ROLES = [
  { value: "buyer", label: "Buyer", hint: "Track my own property purchase(s)" },
  {
    value: "developer_admin",
    label: "Developer / Builder",
    hint: "Manage compliance across many buyers",
  },
] as const;

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signUp, null);
  const [role, setRole] = useState<(typeof ROLES)[number]["value"]>("buyer");

  if (state?.message) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  return (
    <form action={formAction} className="space-y-4">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">I am a…</span>
        <div className="grid grid-cols-2 gap-2">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setRole(r.value)}
              className={clsx(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                role === r.value
                  ? "border-indigo-600 bg-indigo-50 text-indigo-900"
                  : "border-slate-300 text-slate-700 hover:bg-slate-50",
              )}
            >
              <span className="block font-medium">{r.label}</span>
              <span className="block text-xs text-slate-500">{r.hint}</span>
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={role} />
      </div>

      <Field label="Full name" htmlFor="fullName">
        <Input id="fullName" name="fullName" autoComplete="name" required />
      </Field>

      {role === "developer_admin" ? (
        <Field
          label="Organization / builder name"
          htmlFor="orgName"
          hint="Buyers you add will be grouped under this organization"
        >
          <Input id="orgName" name="orgName" required />
        </Field>
      ) : null}

      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="Password" htmlFor="password" hint="At least 8 characters">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </form>
  );
}
