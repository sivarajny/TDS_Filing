-- ============================================================================
-- TDS Property Tracker — initial schema
-- Covers: orgs (developer/builder tenants), profiles/roles, projects,
-- transactions, milestones, versioned TDS rules, lower-deduction certs,
-- documents, and reminder log.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type user_role as enum ('buyer', 'developer_admin');
create type residential_status as enum ('resident', 'nri');
create type filing_form_type as enum ('26QB', '141');
create type lower_deduction_status as enum ('not_applicable', 'applied', 'approved', 'rejected', 'expired');
create type document_type as enum (
  'challan_receipt',
  'form16b_or_141',
  'pan_card',
  'id_proof',
  'lower_deduction_certificate',
  'agreement',
  'other'
);
create type reminder_type as enum ('t_minus_14', 't_minus_7', 't_minus_1', 'overdue');
create type reminder_status as enum ('sent', 'failed');

-- ---------------------------------------------------------------------------
-- orgs — a developer/builder tenant. Buyers who transact independently
-- (no developer relationship) simply have org_id = null on their transaction.
-- ---------------------------------------------------------------------------

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — one row per auth.users row. role drives RLS branching.
-- org_id is set for developer_admin staff, and optionally for buyers who
-- were invited into a developer's org.
-- ---------------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid references orgs (id) on delete set null,
  role user_role not null default 'buyer',
  full_name text,
  email text not null,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_org_id_idx on profiles (org_id);

-- ---------------------------------------------------------------------------
-- projects — optional grouping of transactions under a developer's property
-- project, used by the developer dashboard. Nullable FK from transactions.
-- ---------------------------------------------------------------------------

create table projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs (id) on delete cascade,
  name text not null,
  address text,
  created_at timestamptz not null default now()
);

create index projects_org_id_idx on projects (org_id);

-- ---------------------------------------------------------------------------
-- tds_rules_versions — versioned, auditable ruleset for Section 194-IA.
-- Every milestone calculation records which version it used, so past
-- calculations stay explainable even after rates/thresholds/forms change
-- (e.g. the 26QB -> Form 141 transition on/after 1 Apr 2026).
-- `rules` holds the structured parameters the calculator reads; see
-- src/lib/tds/rules-schema.ts for the shape.
-- ---------------------------------------------------------------------------

create table tds_rules_versions (
  id uuid primary key default gen_random_uuid(),
  version_label text not null unique,
  form_type filing_form_type not null,
  effective_from date not null,
  effective_to date,
  rules jsonb not null,
  notes text,
  created_at timestamptz not null default now(),
  constraint tds_rules_versions_date_range check (effective_to is null or effective_to >= effective_from)
);

-- ---------------------------------------------------------------------------
-- transactions — one property purchase. buyer_id owns it; org_id/project_id
-- are set when it belongs to a developer-managed project.
-- ---------------------------------------------------------------------------

create table transactions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references orgs (id) on delete set null,
  project_id uuid references projects (id) on delete set null,
  buyer_id uuid not null references profiles (id) on delete cascade,
  created_by uuid not null references profiles (id),

  property_address text not null,
  property_value numeric(16, 2) not null check (property_value > 0),
  unit_number text,

  buyer_pan text not null check (buyer_pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  buyer_name text not null,

  seller_name text not null,
  seller_pan text check (seller_pan is null or seller_pan ~ '^[A-Z]{5}[0-9]{4}[A-Z]$'),
  seller_residential_status residential_status not null default 'resident',
  seller_address text,

  status text not null default 'active' check (status in ('active', 'closed', 'archived')),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index transactions_org_id_idx on transactions (org_id);
create index transactions_project_id_idx on transactions (project_id);
create index transactions_buyer_id_idx on transactions (buyer_id);

-- ---------------------------------------------------------------------------
-- lower_deduction_certificates — Form 13 tracking. One active row per
-- transaction covers the "does the buyer have a certificate that changes
-- the deduction rate" checklist from the NRI flow.
-- ---------------------------------------------------------------------------

create table lower_deduction_certificates (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  status lower_deduction_status not null default 'not_applicable',
  certificate_number text,
  certified_rate numeric(5, 2) check (certified_rate is null or (certified_rate >= 0 and certified_rate <= 100)),
  valid_from date,
  valid_to date,
  document_id uuid, -- FK added after `documents` exists
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lower_deduction_certificates_transaction_id_idx on lower_deduction_certificates (transaction_id);

-- ---------------------------------------------------------------------------
-- milestones — payment schedule entries. TDS is calculated per milestone
-- because the seller's residential status / rules version can matter
-- differently for each payment, and the 30-day filing clock is per payment.
-- ---------------------------------------------------------------------------

create table milestones (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  sequence_no integer not null,
  description text not null,
  amount numeric(16, 2) not null check (amount > 0),
  due_date date not null,
  payment_date date,

  rules_version_id uuid references tds_rules_versions (id),
  tds_rate numeric(6, 3),
  tds_amount numeric(16, 2),
  calculation jsonb, -- full breakdown (base rate, surcharge, cess, LDC override) for the pre-fill package

  filing_deadline date generated always as (payment_date + 30) stored,
  filed_at timestamptz,
  challan_number text,
  acknowledgment_number text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint milestones_sequence_unique unique (transaction_id, sequence_no)
);

create index milestones_transaction_id_idx on milestones (transaction_id);
create index milestones_filing_deadline_idx on milestones (filing_deadline) where filed_at is null;

-- ---------------------------------------------------------------------------
-- documents — Supabase Storage objects (challan receipts, Form 16B/141,
-- ID proofs, LDC copies) linked to a transaction and optionally a milestone.
-- ---------------------------------------------------------------------------

create table documents (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references transactions (id) on delete cascade,
  milestone_id uuid references milestones (id) on delete cascade,
  uploaded_by uuid not null references profiles (id),
  doc_type document_type not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz not null default now()
);

create index documents_transaction_id_idx on documents (transaction_id);
create index documents_milestone_id_idx on documents (milestone_id);

alter table lower_deduction_certificates
  add constraint lower_deduction_certificates_document_id_fkey
  foreign key (document_id) references documents (id) on delete set null;

-- ---------------------------------------------------------------------------
-- reminders_log — audit + idempotency guard for the T-14/T-7/T-1/overdue
-- email reminders sent by the cron job.
-- ---------------------------------------------------------------------------

create table reminders_log (
  id uuid primary key default gen_random_uuid(),
  milestone_id uuid not null references milestones (id) on delete cascade,
  reminder_type reminder_type not null,
  recipient_email text not null,
  status reminder_status not null,
  error_message text,
  sent_at timestamptz not null default now(),
  constraint reminders_log_unique_per_milestone unique (milestone_id, reminder_type)
);

create index reminders_log_milestone_id_idx on reminders_log (milestone_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------

create function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on profiles for each row execute function set_updated_at();
create trigger set_updated_at before update on transactions for each row execute function set_updated_at();
create trigger set_updated_at before update on milestones for each row execute function set_updated_at();
create trigger set_updated_at before update on lower_deduction_certificates for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- New auth.users -> profiles bridge. role/org_id/full_name are seeded from
-- signup metadata (see src/lib/auth/sign-up.ts).
-- ---------------------------------------------------------------------------

create function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, org_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce((new.raw_user_meta_data ->> 'role')::user_role, 'buyer'),
    nullif(new.raw_user_meta_data ->> 'org_id', '')::uuid
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Compliance status view — single place that derives the milestone's
-- filing-status label so the dashboard and pre-fill screens agree.
-- ---------------------------------------------------------------------------

create view v_milestones_with_status as
select
  m.*,
  case
    when m.filed_at is not null then 'filed'
    when m.payment_date is null then 'upcoming'
    when m.filing_deadline < current_date then 'overdue'
    when m.filing_deadline - current_date <= 7 then 'due_soon'
    else 'upcoming'
  end as compliance_status
from milestones m;
