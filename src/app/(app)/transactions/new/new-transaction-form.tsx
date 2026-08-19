"use client";

import { useActionState, useMemo, useState } from "react";
import { createTransaction } from "@/lib/transactions/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { clsx } from "@/lib/utils";

type BuyerOption = { id: string; full_name: string | null; email: string };
type ProjectOption = { id: string; name: string };

type MilestoneRow = { description: string; amount: string; dueDate: string };

const EMPTY_ROW: MilestoneRow = { description: "", amount: "", dueDate: "" };

export function NewTransactionForm({
  role,
  buyers = [],
  projects = [],
  defaultBuyerName,
}: {
  role: "buyer" | "developer_admin";
  buyers?: BuyerOption[];
  projects?: ProjectOption[];
  defaultBuyerName?: string;
}) {
  const [state, formAction, pending] = useActionState(createTransaction, null);
  const [sellerStatus, setSellerStatus] = useState<"resident" | "nri">("resident");
  const [buyerMode, setBuyerMode] = useState<"existing" | "invite">(
    buyers.length > 0 ? "existing" : "invite",
  );
  const [projectMode, setProjectMode] = useState<"existing" | "new" | "none">(
    projects.length > 0 ? "existing" : "none",
  );
  const [milestones, setMilestones] = useState<MilestoneRow[]>([{ ...EMPTY_ROW }]);
  const [propertyValue, setPropertyValue] = useState("");

  const milestonesTotal = useMemo(
    () => milestones.reduce((sum, m) => sum + (Number(m.amount) || 0), 0),
    [milestones],
  );

  function updateMilestone(index: number, patch: Partial<MilestoneRow>) {
    setMilestones((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addMilestone() {
    setMilestones((rows) => [...rows, { ...EMPTY_ROW }]);
  }

  function removeMilestone(index: number) {
    setMilestones((rows) => (rows.length > 1 ? rows.filter((_, i) => i !== index) : rows));
  }

  return (
    <form action={formAction} className="space-y-8">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}

      {role === "developer_admin" ? (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-900">Buyer</h2>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton
              active={buyerMode === "existing"}
              onClick={() => setBuyerMode("existing")}
              disabled={buyers.length === 0}
            >
              Existing buyer
            </ModeButton>
            <ModeButton active={buyerMode === "invite"} onClick={() => setBuyerMode("invite")}>
              Invite new buyer
            </ModeButton>
          </div>
          <input type="hidden" name="buyerMode" value={buyerMode} />

          {buyerMode === "existing" ? (
            <Field label="Select buyer" htmlFor="buyerId">
              <select
                id="buyerId"
                name="buyerId"
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select…</option>
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.full_name ?? b.email}
                  </option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Buyer name" htmlFor="inviteBuyerName">
                <Input id="inviteBuyerName" name="inviteBuyerName" required />
              </Field>
              <Field
                label="Buyer email"
                htmlFor="inviteBuyerEmail"
                hint="They'll get an invite email to set a password"
              >
                <Input id="inviteBuyerEmail" name="inviteBuyerEmail" type="email" required />
              </Field>
            </div>
          )}

          <h2 className="text-sm font-semibold text-slate-900">Project (optional)</h2>
          <div className="grid grid-cols-3 gap-2">
            <ModeButton
              active={projectMode === "existing"}
              onClick={() => setProjectMode("existing")}
              disabled={projects.length === 0}
            >
              Existing
            </ModeButton>
            <ModeButton active={projectMode === "new"} onClick={() => setProjectMode("new")}>
              New
            </ModeButton>
            <ModeButton active={projectMode === "none"} onClick={() => setProjectMode("none")}>
              None
            </ModeButton>
          </div>
          {projectMode === "existing" ? (
            <Field label="Project" htmlFor="projectId">
              <select
                id="projectId"
                name="projectId"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {projectMode === "new" ? (
            <Field label="New project name" htmlFor="newProjectName">
              <Input id="newProjectName" name="newProjectName" />
            </Field>
          ) : null}
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Property</h2>
        <Field label="Property address" htmlFor="propertyAddress">
          <Input id="propertyAddress" name="propertyAddress" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Unit / flat number (optional)" htmlFor="unitNumber">
            <Input id="unitNumber" name="unitNumber" />
          </Field>
          <Field label="Total consideration (₹)" htmlFor="propertyValue">
            <Input
              id="propertyValue"
              name="propertyValue"
              type="number"
              min="1"
              step="1"
              required
              value={propertyValue}
              onChange={(e) => setPropertyValue(e.target.value)}
            />
          </Field>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Buyer details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Buyer full name (as per PAN)" htmlFor="buyerName">
            <Input id="buyerName" name="buyerName" defaultValue={defaultBuyerName} required />
          </Field>
          <Field label="Buyer PAN" htmlFor="buyerPan">
            <Input
              id="buyerPan"
              name="buyerPan"
              placeholder="ABCDE1234F"
              maxLength={10}
              className="uppercase"
              required
            />
          </Field>
        </div>
        <Field
          label="Buyer address (optional)"
          htmlFor="buyerAddress"
          hint="Used on the pre-fill package if different from the property address — common for NRI buyers"
        >
          <Input id="buyerAddress" name="buyerAddress" />
        </Field>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Seller details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Seller full name" htmlFor="sellerName">
            <Input id="sellerName" name="sellerName" required />
          </Field>
          <Field label="Seller PAN (leave blank if unavailable)" htmlFor="sellerPan">
            <Input id="sellerPan" name="sellerPan" placeholder="ABCDE1234F" maxLength={10} className="uppercase" />
          </Field>
        </div>
        <Field label="Seller address (optional)" htmlFor="sellerAddress">
          <Input id="sellerAddress" name="sellerAddress" />
        </Field>

        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Seller residential status
          </span>
          <div className="grid grid-cols-2 gap-2">
            <ModeButton active={sellerStatus === "resident"} onClick={() => setSellerStatus("resident")}>
              Resident
            </ModeButton>
            <ModeButton active={sellerStatus === "nri"} onClick={() => setSellerStatus("nri")}>
              NRI
            </ModeButton>
          </div>
          <input type="hidden" name="sellerResidentialStatus" value={sellerStatus} />
          {sellerStatus === "nri" ? (
            <p className="mt-2 text-xs text-amber-700">
              NRI sellers usually attract a higher TDS rate. You&apos;ll be able to record a Form
              13 Lower/Nil Deduction Certificate on the transaction page once it&apos;s approved.
            </p>
          ) : null}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Payment milestones</h2>
          <span className="text-xs text-slate-500">
            Total: ₹{milestonesTotal.toLocaleString("en-IN")}
            {propertyValue ? ` / ₹${Number(propertyValue).toLocaleString("en-IN")}` : ""}
          </span>
        </div>

        <div className="space-y-3">
          {milestones.map((row, index) => (
            <div
              key={index}
              className="grid gap-3 rounded-md border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <Field label="Description" htmlFor={`milestone-desc-${index}`}>
                <Input
                  id={`milestone-desc-${index}`}
                  value={row.description}
                  onChange={(e) => updateMilestone(index, { description: e.target.value })}
                  placeholder="e.g. Booking amount"
                  required
                />
              </Field>
              <Field label="Amount (₹)" htmlFor={`milestone-amount-${index}`}>
                <Input
                  id={`milestone-amount-${index}`}
                  type="number"
                  min="1"
                  step="1"
                  value={row.amount}
                  onChange={(e) => updateMilestone(index, { amount: e.target.value })}
                  required
                />
              </Field>
              <Field label="Due date" htmlFor={`milestone-date-${index}`}>
                <Input
                  id={`milestone-date-${index}`}
                  type="date"
                  value={row.dueDate}
                  onChange={(e) => updateMilestone(index, { dueDate: e.target.value })}
                  required
                />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => removeMilestone(index)}
                  disabled={milestones.length === 1}
                  className="text-red-600 hover:bg-red-50"
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="secondary" onClick={addMilestone}>
          + Add milestone
        </Button>

        <input type="hidden" name="milestonesJson" value={JSON.stringify(milestones)} />
      </section>

      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Creating…" : "Create transaction"}
      </Button>
    </form>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={clsx(
        "rounded-md border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-indigo-600 bg-indigo-50 text-indigo-900"
          : "border-slate-300 text-slate-700 hover:bg-slate-50",
      )}
    >
      {children}
    </button>
  );
}
