-- 0050: follow-ups from the review of 0048. Safe to run any time.
--
-- 1. Deleting an account must clear that person out of their old notices and
--    houses. pin_notice_author (0048) and pin_house_owner (0040) put the old
--    value back on EVERY update, including the one Postgres runs for
--    "on delete set null", so a deleted person's id stayed behind in
--    notices.posted_by and houses.created_by, pointing at nobody (and a
--    restore from backup would fail to re-add those foreign keys). Both now
--    pin only signed-in requests; with no signed-in user the change is the
--    server's own (an account deletion, maintenance). Anything left pointing
--    at a deleted account is cleared below.
-- 2. Trigger functions can't be called on their own, but Supabase's Security
--    Advisor still lists them as callable: revoke, as 0045 and 0046 do.

create or replace function public.pin_notice_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No signed-in user means the server or the database itself (an account
  -- deletion clearing posted_by), which may change anything.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The poster is the author, whatever the request said.
    new.posted_by := auth.uid();
    return new;
  end if;

  -- An existing notice stays where it is and keeps its author...
  new.posted_by := old.posted_by;
  new.house_id  := old.house_id;
  -- ...and only that author may change what it says. Pinning stays open to
  -- the whole house.
  if auth.uid() is distinct from old.posted_by
     and (new.title is distinct from old.title or new.message is distinct from old.message) then
    raise exception 'notice_author_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function public.pin_house_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No signed-in user means the server or the database itself (deleting an
  -- owner's account clears created_by), which may change anything.
  if auth.uid() is null then
    return new;
  end if;

  if current_setting('housesync.allow_admin_transfer', true) is distinct from 'on' then
    new.created_by := old.created_by;
  end if;
  new.invite_code := old.invite_code;
  return new;
end;
$$;

revoke all on function public.pin_notice_author() from public, anon, authenticated;
revoke all on function public.note_house_changes() from public, anon, authenticated;
revoke all on function public.pin_house_owner() from public, anon, authenticated;

-- Clear anything already pointing at a deleted account.
update public.notices n
   set posted_by = null
 where n.posted_by is not null
   and not exists (select 1 from auth.users u where u.id = n.posted_by);

update public.houses h
   set created_by = null
 where h.created_by is not null
   and not exists (select 1 from auth.users u where u.id = h.created_by);

-- Check: one row back. The first two should read 0. The last is for
-- information: houses whose owner deleted their account (nobody can remove
-- members or delete those houses until someone is made admin).
select
  (select count(*) from public.notices n
    where n.posted_by is not null
      and not exists (select 1 from auth.users u where u.id = n.posted_by))  as notices_left_pointing_at_nobody_0,
  (select count(*) from public.houses h
    where h.created_by is not null
      and not exists (select 1 from auth.users u where u.id = h.created_by)) as houses_left_pointing_at_nobody_0,
  (select count(*) from public.houses h
    where h.created_by is null
      and exists (select 1 from public.house_members m where m.house_id = h.id)) as houses_without_an_owner;
