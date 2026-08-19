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

## Project structure

- `supabase/migrations/` — versioned schema, RLS policies, storage bucket
  setup, and the seeded initial TDS rules version.
- `src/lib/supabase/` — browser/server/admin Supabase clients + the auth
  session-refresh proxy (Next.js 16 renamed `middleware.ts` → `proxy.ts`).
- `src/lib/tds/` — the versioned TDS calculation engine (reads
  `tds_rules_versions` from the DB rather than hardcoding rates).
- `src/types/database.types.ts` — hand-maintained types matching the schema;
  regenerate with `npx supabase gen types typescript --linked` once linked
  to a live project and reconcile any drift.

## Data model

`orgs` (developer/builder tenants) → `profiles` (buyer or developer_admin,
role-gated via RLS) → `transactions` (one property purchase) →
`milestones` (payment schedule, each with its own TDS calculation and
30-day statutory filing clock) → `documents` (Supabase Storage: challan
receipts, Form 16B/141, ID proofs) plus `lower_deduction_certificates`
(Form 13 tracking) and `reminders_log` (T-14/T-7/T-1 email audit trail).
