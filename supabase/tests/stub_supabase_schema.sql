-- ============================================================================
-- Minimal stand-ins for the Supabase-managed auth/storage schemas, plus the
-- role/grant model Supabase actually applies (authenticated/anon roles with
-- table grants + a settable auth.uid()). Lets supabase/migrations/*.sql be
-- validated against a plain local Postgres — both that it applies cleanly
-- AND that RLS policies genuinely enforce (as the `authenticated` role,
-- not as the Postgres superuser, which silently bypasses RLS and would
-- make policy tests meaningless).
--
-- Used by .github/workflows/ci.yml and can be run locally:
--   psql -d some_test_db -f supabase/tests/stub_supabase_schema.sql
--   for f in supabase/migrations/*.sql; do psql -d some_test_db -f "$f"; done
--
-- To simulate a specific signed-in user in a psql session afterward:
--   begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<uuid>';
--   ... queries run as that user, RLS enforced ...
--   rollback;
-- ============================================================================

create role authenticated;
create role anon;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- Reads a session-local GUC we set per test to simulate a specific JWT subject.
create function auth.uid() returns uuid as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$ language sql stable;

grant usage on schema public to authenticated, anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

create schema storage;
create table storage.buckets (
  id text primary key,
  name text not null,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name text
);
create function storage.foldername(name text) returns text[] as $$
  select string_to_array(name, '/');
$$ language sql immutable;

grant usage on schema storage to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated;
