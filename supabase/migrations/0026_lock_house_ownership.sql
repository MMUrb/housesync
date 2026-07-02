-- ============================================================================
-- Security hardening. Run once in the Supabase SQL Editor; safe to re-run.
--
-- 1) Stop a house MEMBER from seizing ownership or self-promoting.
--    The houses / house_members UPDATE policies (intentionally) let members
--    edit descriptive fields, but nothing stopped a member from setting
--    houses.created_by = themselves (owner powers: delete house, remove members)
--    or house_members.role = 'admin'. These BEFORE UPDATE triggers pin the
--    sensitive columns to their previous values, so they can only ever be set by
--    the create_house / join_house RPCs (which INSERT — triggers don't fire).
--
-- 2) Re-assert that the receipts bucket is PRIVATE and house-scoped (idempotent
--    with 0022). Belt-and-braces in case an older public config lingers.
-- ============================================================================

-- --- 1) Ownership / role are immutable via the member UPDATE policies --------
create or replace function public.pin_house_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.created_by := old.created_by;
  new.invite_code := old.invite_code;
  return new;
end;
$$;

drop trigger if exists trg_pin_house_owner on public.houses;
create trigger trg_pin_house_owner
  before update on public.houses
  for each row execute function public.pin_house_owner();

create or replace function public.pin_member_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.role := old.role;
  return new;
end;
$$;

drop trigger if exists trg_pin_member_role on public.house_members;
create trigger trg_pin_member_role
  before update on public.house_members
  for each row execute function public.pin_member_role();

-- --- 2) Receipts bucket stays private + house-scoped (idempotent) ------------
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
