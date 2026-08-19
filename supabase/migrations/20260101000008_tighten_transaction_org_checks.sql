-- The original transactions INSERT/UPDATE policies checked buyer_id /
-- org-admin-ship but never verified that org_id/project_id on the row
-- actually correspond to the caller's own org. Direct API access (bypassing
-- the app's server actions, which do set these correctly) could tag a
-- transaction with an arbitrary org_id, making it appear in that org's
-- developer dashboard. Tighten WITH CHECK so the DB itself enforces this,
-- not just app code.

drop policy "buyers can insert own transactions" on transactions;
drop policy "buyers can update own transactions" on transactions;
drop policy "org admins can insert org transactions" on transactions;
drop policy "org admins can update org transactions" on transactions;

create policy "buyers can insert own transactions"
  on transactions for insert
  with check (
    buyer_id = auth.uid()
    and created_by = auth.uid()
    and (org_id is null or org_id = current_profile_org_id())
    and (
      project_id is null
      or (org_id is not null and exists (
        select 1 from projects p where p.id = project_id and p.org_id = org_id
      ))
    )
  );

create policy "buyers can update own transactions"
  on transactions for update
  using (buyer_id = auth.uid())
  with check (
    buyer_id = auth.uid()
    and (org_id is null or org_id = current_profile_org_id())
    and (
      project_id is null
      or (org_id is not null and exists (
        select 1 from projects p where p.id = project_id and p.org_id = org_id
      ))
    )
  );

create policy "org admins can insert org transactions"
  on transactions for insert
  with check (
    is_org_admin_for(org_id)
    and created_by = auth.uid()
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = project_id and p.org_id = org_id)
    )
  );

create policy "org admins can update org transactions"
  on transactions for update
  using (is_org_admin_for(org_id))
  with check (
    is_org_admin_for(org_id)
    and (
      project_id is null
      or exists (select 1 from projects p where p.id = project_id and p.org_id = org_id)
    )
  );
