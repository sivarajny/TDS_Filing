-- ============================================================================
-- Storage — private "documents" bucket for challan receipts, Form 16B/141,
-- PAN/ID proofs, and LDC copies. Objects are keyed as
-- "<transaction_id>/<uuid>-<filename>" so RLS can reuse owns_transaction().
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "transaction stakeholders can read documents bucket"
  on storage.objects for select
  using (
    bucket_id = 'documents'
    and owns_transaction((storage.foldername(name))[1]::uuid)
  );

create policy "transaction stakeholders can upload to documents bucket"
  on storage.objects for insert
  with check (
    bucket_id = 'documents'
    and owns_transaction((storage.foldername(name))[1]::uuid)
  );

create policy "transaction stakeholders can delete from documents bucket"
  on storage.objects for delete
  using (
    bucket_id = 'documents'
    and owns_transaction((storage.foldername(name))[1]::uuid)
  );
