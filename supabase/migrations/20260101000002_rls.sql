-- ============================================================================
-- Row Level Security
--
-- Model: a buyer sees only their own transactions; a developer_admin sees
-- every transaction under their org. Helper functions read `profiles` as
-- security definer so policies that need "my org" / "my role" don't recurse
-- into profiles' own RLS.
-- ============================================================================

create function current_profile_role() returns user_role as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create function current_profile_org_id() returns uuid as $$
  select org_id from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create function is_org_admin_for(target_org uuid) returns boolean as $$
  select target_org is not null
     and current_profile_role() = 'developer_admin'
     and current_profile_org_id() = target_org;
$$ language sql stable security definer set search_path = public;

create function owns_transaction(target_transaction uuid) returns boolean as $$
  select exists (
    select 1 from public.transactions t
    where t.id = target_transaction
      and (
        t.buyer_id = auth.uid()
        or is_org_admin_for(t.org_id)
      )
  );
$$ language sql stable security definer set search_path = public;

-- ---------------------------------------------------------------------------
-- orgs
-- ---------------------------------------------------------------------------

alter table orgs enable row level security;

create policy "org members can view their org"
  on orgs for select
  using (id = current_profile_org_id());

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

alter table profiles enable row level security;

create policy "users can view own profile"
  on profiles for select
  using (id = auth.uid());

create policy "org admins can view profiles in their org"
  on profiles for select
  using (org_id is not null and is_org_admin_for(org_id));

create policy "users can update own profile"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------------------

alter table projects enable row level security;

create policy "org admins manage their projects"
  on projects for all
  using (is_org_admin_for(org_id))
  with check (is_org_admin_for(org_id));

-- buyers need to read the project name/address of transactions they own
create policy "buyers can view project of their transaction"
  on projects for select
  using (
    exists (
      select 1 from transactions t
      where t.project_id = projects.id and t.buyer_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- tds_rules_versions — reference data, readable by any authenticated user,
-- writable only via service role (migrations/admin scripts).
-- ---------------------------------------------------------------------------

alter table tds_rules_versions enable row level security;

create policy "authenticated users can read rules"
  on tds_rules_versions for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- transactions
-- ---------------------------------------------------------------------------

alter table transactions enable row level security;

create policy "buyers can view own transactions"
  on transactions for select
  using (buyer_id = auth.uid());

create policy "buyers can insert own transactions"
  on transactions for insert
  with check (buyer_id = auth.uid() and created_by = auth.uid());

create policy "buyers can update own transactions"
  on transactions for update
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

create policy "org admins can view org transactions"
  on transactions for select
  using (is_org_admin_for(org_id));

create policy "org admins can insert org transactions"
  on transactions for insert
  with check (is_org_admin_for(org_id) and created_by = auth.uid());

create policy "org admins can update org transactions"
  on transactions for update
  using (is_org_admin_for(org_id))
  with check (is_org_admin_for(org_id));

-- ---------------------------------------------------------------------------
-- milestones
-- ---------------------------------------------------------------------------

alter table milestones enable row level security;

create policy "transaction stakeholders can view milestones"
  on milestones for select
  using (owns_transaction(transaction_id));

create policy "transaction stakeholders can insert milestones"
  on milestones for insert
  with check (owns_transaction(transaction_id));

create policy "transaction stakeholders can update milestones"
  on milestones for update
  using (owns_transaction(transaction_id))
  with check (owns_transaction(transaction_id));

create policy "transaction stakeholders can delete milestones"
  on milestones for delete
  using (owns_transaction(transaction_id));

-- ---------------------------------------------------------------------------
-- lower_deduction_certificates
-- ---------------------------------------------------------------------------

alter table lower_deduction_certificates enable row level security;

create policy "transaction stakeholders can view ldc"
  on lower_deduction_certificates for select
  using (owns_transaction(transaction_id));

create policy "transaction stakeholders can manage ldc"
  on lower_deduction_certificates for all
  using (owns_transaction(transaction_id))
  with check (owns_transaction(transaction_id));

-- ---------------------------------------------------------------------------
-- documents
-- ---------------------------------------------------------------------------

alter table documents enable row level security;

create policy "transaction stakeholders can view documents"
  on documents for select
  using (owns_transaction(transaction_id));

create policy "transaction stakeholders can upload documents"
  on documents for insert
  with check (owns_transaction(transaction_id) and uploaded_by = auth.uid());

create policy "transaction stakeholders can delete documents"
  on documents for delete
  using (owns_transaction(transaction_id));

-- ---------------------------------------------------------------------------
-- reminders_log — read-only for stakeholders, written by service role only
-- (no insert/update/delete policy for authenticated users).
-- ---------------------------------------------------------------------------

alter table reminders_log enable row level security;

create policy "transaction stakeholders can view reminders"
  on reminders_log for select
  using (
    owns_transaction((select transaction_id from milestones where id = reminders_log.milestone_id))
  );
