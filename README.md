# TDS Property Tracker

Helps property buyers, NRIs, and developers track the Section 194-IA TDS
obligation that arises on property purchases in India (Form 26QB, moving to
unified Form 141 for transactions on/after 1 Apr 2026), synced to the
buyer-seller payment milestone schedule.

**This tool is a compliance tracker and pre-fill data generator — it does
not file anything on the government portal for you and does not give tax
advice.** The Income Tax e-filing portal has no public API; any attempt to
automate login/OTP/CAPTCHA/submission against it carries real ToS and
liability risk. See the in-app disclaimer on every calculation and pre-fill
screen.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase (Postgres + Row Level Security + Supabase Auth + Storage)
- Hosting target: Vercel

## Getting started

1. Create a Supabase project (or run one locally with `npx supabase start`,
   requires Docker).
2. Copy `.env.local.example` to `.env.local` and fill in your project's URL
   and keys (Project Settings → API).
3. Apply the schema:
   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```
   or, for local dev: `npx supabase start` (auto-applies `supabase/migrations`).
4. Install deps and run:
   ```bash
   npm install
   npm run dev
   ```
5. (Optional, for email reminders) Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL`,
   `NEXT_PUBLIC_APP_URL`, and `CRON_SECRET` in `.env.local` and on Vercel.
   `vercel.json` schedules `/api/cron/reminders` daily at 03:00 UTC; Vercel
   Cron automatically sends `Authorization: Bearer $CRON_SECRET`, which the
   route checks. Without `RESEND_API_KEY`/`CRON_SECRET` set, the endpoint
   just 401s — nothing else in the app depends on it.
6. Seed demo data (needs `NEXT_PUBLIC_SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`, pointed at a project with
   the migrations applied):
   ```bash
   npm run seed
   ```
   Creates one developer org ("Skyline Developers") with two buyers, one
   standalone buyer, and one CA/consultant (linked read-only to the
   standalone buyer) — three transactions spanning resident + NRI sellers,
   an approved Form 13 LDC, filed/overdue/due-soon/upcoming milestones, and
   the 26QB → Form 141 handover. Prints demo logins at the end (all use the
   password `DemoPass123!`) — change or delete these before using the
   project for anything real. Safe to re-run: it looks up existing
   users/orgs/projects by email/name instead of duplicating them, though it
   will insert duplicate transactions on a second run.

## Project structure

- `supabase/migrations/` — versioned schema, RLS policies, storage bucket
  setup, and the seeded initial TDS rules version.
- `src/lib/supabase/` — browser/server/admin Supabase clients + the auth
  session-refresh proxy (Next.js 16 renamed `middleware.ts` → `proxy.ts`).
- `src/lib/tds/` — the versioned TDS calculation engine (reads
  `tds_rules_versions` from the DB rather than hardcoding rates).
- `src/app/api/cron/reminders/` — the daily T-14/T-7/T-1/overdue email job
  (`src/lib/email/`), gated by `CRON_SECRET` and idempotent via
  `reminders_log`'s unique `(milestone_id, reminder_type)` constraint.
- `src/types/database.types.ts` — hand-maintained types matching the schema;
  regenerate with `npx supabase gen types typescript --linked` once linked
  to a live project and reconcile any drift.

## Data model

`orgs` (developer/builder tenants) → `profiles` (buyer, developer_admin, or
ca — role-gated via RLS) → `transactions` (one property purchase) →
`milestones` (payment schedule, each with its own TDS calculation and
30-day statutory filing clock) → `documents` (Supabase Storage: challan
receipts, Form 16B/141, ID proofs) plus `lower_deduction_certificates`
(Form 13 tracking) and `reminders_log` (T-14/T-7/T-1 email audit trail).
`advisor_links` (buyer_id, advisor_id) grants a CA/consultant read-only
access — via RLS SELECT-only policies, not app-level checks — to every
transaction the linking buyer owns; buyers manage their own links from
`/dashboard`.

## Roles

- **buyer** — tracks their own transaction(s); can invite advisors.
- **developer_admin** — manages transactions/buyers across their org.
- **ca** — read-only, granted per-buyer via `advisor_links`. Never gets a
  write path in RLS (not app-level hiding), so even direct API access can't
  mutate anything; the UI additionally hides write controls for clarity.

Role/org assignment is never trusted from client-suppliable signup
metadata — see the comment on `handle_new_user()` in
`supabase/migrations/20260101000009_fix_signup_privilege_escalation.sql`
and the corresponding logic in `src/lib/auth/actions.ts`.
