"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { inviteAdvisor, removeAdvisor } from "@/lib/advisors/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";

type AdvisorEntry = {
  link: { id: string };
  advisor: { id: string; email: string; full_name: string | null } | null;
};

export function AdvisorsPanel({ advisors }: { advisors: AdvisorEntry[] }) {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Advisors</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            CAs/consultants you invite get read-only access to all of your transactions — they
            can never record payments, mark filings, or upload documents.
          </p>
        </div>
        <Button variant="secondary" onClick={() => setShowInvite((v) => !v)}>
          {showInvite ? "Cancel" : "Invite advisor"}
        </Button>
      </div>

      {showInvite ? <InviteForm onDone={() => setShowInvite(false)} /> : null}

      {advisors.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-100">
          {advisors.map(({ link, advisor }) => (
            <li key={link.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-slate-700">
                {advisor?.full_name ?? advisor?.email ?? "Unknown"}
                {advisor?.full_name ? (
                  <span className="text-slate-400"> · {advisor.email}</span>
                ) : null}
              </span>
              <RemoveButton linkId={link.id} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No advisors have access yet.</p>
      )}
    </div>
  );
}

function InviteForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(inviteAdvisor, null);
  const submittedRef = useRef(false);

  useEffect(() => {
    if (submittedRef.current && !pending && !state?.error) {
      onDone();
    }
  }, [pending, state, onDone]);

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submittedRef.current = true;
      }}
      className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3"
    >
      {state?.error ? (
        <Alert tone="error" className="w-full">
          {state.error}
        </Alert>
      ) : null}
      <Field label="Advisor name (optional)" htmlFor="advisorName">
        <Input id="advisorName" name="advisorName" />
      </Field>
      <Field label="Advisor email" htmlFor="advisorEmail">
        <Input id="advisorEmail" name="advisorEmail" type="email" required />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? "Inviting…" : "Invite"}
      </Button>
    </form>
  );
}

function RemoveButton({ linkId }: { linkId: string }) {
  const [, formAction, pending] = useActionState(removeAdvisor, null);
  return (
    <form action={formAction}>
      <input type="hidden" name="linkId" value={linkId} />
      <Button type="submit" variant="ghost" disabled={pending} className="text-xs text-red-600 hover:bg-red-50">
        Remove
      </Button>
    </form>
  );
}
