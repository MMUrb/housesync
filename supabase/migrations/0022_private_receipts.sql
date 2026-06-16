-- ============================================================================
-- Lock down receipt photos. The receipts bucket was public-read — anyone with
-- the URL could open someone's receipt (which can show names, addresses, card
-- digits). Make it private and scope every operation to members of the house
-- the receipt belongs to. The first path segment is the house id
-- ("<house_id>/<file>"), so we match it against the caller's memberships.
-- Receipts are written via the app and (in future) viewed via short-lived
-- signed URLs (storage.createSignedUrl). Run once in the Supabase SQL Editor;
-- safe to re-run.
-- ============================================================================

update storage.buckets set public = false where id = 'receipts';

drop policy if exists "receipts_read" on storage.objects;
create policy "receipts_read" on storage.objects for select to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select house_id::text from public.house_members where user_id = auth.uid()
    )
  );

drop policy if exists "receipts_insert" on storage.objects;
create policy "receipts_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select house_id::text from public.house_members where user_id = auth.uid()
    )
  );

drop policy if exists "receipts_update" on storage.objects;
create policy "receipts_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select house_id::text from public.house_members where user_id = auth.uid()
    )
  );

drop policy if exists "receipts_delete" on storage.objects;
create policy "receipts_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] in (
      select house_id::text from public.house_members where user_id = auth.uid()
    )
  );
