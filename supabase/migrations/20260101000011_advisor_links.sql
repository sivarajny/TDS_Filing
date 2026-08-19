-- ============================================================================
-- CA/consultant read-only access. A buyer can link a CA (by email — the app
-- either finds an existing 'ca' profile or invites a new one) who then gets
-- SELECT-only access to every transaction that buyer owns. Advisors never
-- get INSERT/UPDATE/DELETE on transaction data — only on their own
-- membership row in advisor_links, which the buyer also controls.
-- ============================================================================

create table advisor_links (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles (id) on delete cascade,
  advisor_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint advisor_links_unique unique (buyer_id, advisor_id)
);

create index advisor_links_buyer_id_idx on advisor_links (buyer_id);
create index advisor_links_advisor_id_idx on advisor_links (advisor_id);

alter table advisor_links enable row level security;

create policy "buyers manage their own advisor links"
  on advisor_links for all
  using (buyer_id = auth.uid())
  with check (buyer_id = auth.uid());

create policy "advisors can view their own links"
  on advisor_links for select
  using (advisor_id = auth.uid());

create function is_advisor_for_buyer(target_buyer uuid) returns boolean as $$
  select exists (
    select 1 from advisor_links al
    where al.buyer_id = target_buyer and al.advisor_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create policy "advisors can view linked buyers' transactions"
  on transactions for select
  using (is_advisor_for_buyer(buyer_id));

create policy "advisors can view linked buyers' milestones"
  on milestones for select
  using (
    exists (
      select 1 from transactions t
      where t.id = milestones.transaction_id and is_advisor_for_buyer(t.buyer_id)
    )
  );

create policy "advisors can view linked buyers' documents"
  on documents for select
  using (
    exists (
      select 1 from transactions t
      where t.id = documents.transaction_id and is_advisor_for_buyer(t.buyer_id)
    )
  );

create policy "advisors can view linked buyers' ldc"
  on lower_deduction_certificates for select
  using (
    exists (
      select 1 from transactions t
      where t.id = lower_deduction_certificates.transaction_id
        and is_advisor_for_buyer(t.buyer_id)
    )
  );

create policy "advisors can read documents bucket for linked buyers"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and exists (
      select 1 from transactions t
      where t.id = (storage.foldername(name))[1]::uuid
        and is_advisor_for_buyer(t.buyer_id)
    )
  );
