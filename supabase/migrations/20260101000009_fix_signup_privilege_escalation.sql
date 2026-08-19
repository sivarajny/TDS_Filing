-- ============================================================================
-- Privilege escalation fix.
--
-- handle_new_user() previously trusted `role`/`org_id` straight out of
-- auth.users.raw_user_meta_data. That field is populated the same way
-- whether it was set by our trusted server actions (admin.createUser /
-- admin.inviteUserByEmail, using the service-role key) or by anyone calling
-- the *public* supabase.auth.signUp() client method directly with
-- arbitrary options.data — the trigger cannot tell those apart. In
-- practice that meant any unauthenticated caller could self-register as
-- 'developer_admin' for any org whose UUID they knew (or splice themselves
-- in as a 'buyer' under it), by calling signUp() outside the app's UI.
--
-- Fix: the trigger no longer trusts metadata for role/org_id at all — every
-- new profile starts as a plain buyer with no org. Privileged assignment
-- (making the signup's own account a developer_admin on the org it just
-- created; attaching an invited buyer to the inviting org) now happens as
-- an explicit follow-up UPDATE from trusted server code using the
-- service-role client, *after* verifying the caller's own authority
-- server-side — see src/lib/auth/actions.ts and
-- src/lib/transactions/actions.ts.
-- ============================================================================

create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = public;
