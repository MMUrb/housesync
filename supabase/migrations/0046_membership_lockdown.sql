-- 0046: Membership lockdown. Only a fresh invite link gets you into a house,
-- links die after 10 minutes, only the house admin can make them, and a
-- removal sticks until the admin invites that person back.
--
-- Before this migration:
--   * members_insert only checked user_id = auth.uid(), so anyone holding a
--     house's id could add themselves (even with role 'admin') by calling the
--     REST API directly with Prefer: return=minimal. No invite needed.
--   * members_update let a member rewrite their own row, including house_id,
--     so they could move themselves into another house the same way.
--   * Each house had one invite link (houses.invite_code) that never expired,
--     and any member could share it.
--   * Nothing remembered who left or was removed, so a removed person could
--     walk straight back in with the old link.
--
-- After it:
--   * Nobody writes house_members directly. The only ways in are create_house
--     and join_house (both SECURITY DEFINER); the only update is the role swap
--     inside transfer_house_admin. No app code inserts or updates the table.
--   * Invite links come from create_house_invite: house admin only, a fresh
--     random code each time, valid for 10 minutes for anyone who taps it in
--     that time. join_house accepts nothing else, so the old permanent links
--     (houses.invite_code) stop working the moment this runs.
--   * house_departures remembers who left and who was removed, with a name
--     snapshot for the admin's "adjust their share" reminder (their profile
--     stops being readable once they've gone). join_house refuses a removed
--     person, whatever link they hold, until the admin invites them back with
--     set_house_reinvite. Leavers just need a new link like anyone else.
--   * Joining again clears the departure, so a later removal starts fresh.
--   * Also closed while here: feed lines can only be written as yourself, and
--     houses can only be created by create_house (section 7).
--
-- Run order: this SQL first, then deploy the app code straight away. In
-- between, the old app still shows the old permanent links, which no longer
-- work; the new code makes 10-minute links instead.

-- --- 1) No direct writes to house_members ----------------------------------
drop policy if exists "members_insert" on public.house_members;
drop policy if exists "members_update" on public.house_members;

-- Belt and braces: even a future SECURITY DEFINER path can't move a
-- membership row to another house or person. role stays pinned unless the
-- transfer RPC has set its transaction-local flag (0040).
create or replace function public.pin_member_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.house_id := old.house_id;
  new.user_id  := old.user_id;
  if current_setting('housesync.allow_admin_transfer', true) is distinct from 'on' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- --- 2) Remember who left and who was removed ------------------------------
-- One row per person per house (the latest departure). name/avatar are a
-- snapshot: once someone has gone, the house can no longer read their profile,
-- but the admin still needs to know who they were.
create table if not exists public.house_departures (
  house_id     uuid not null references public.houses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  kind         text not null check (kind in ('left', 'removed')),
  name         text,
  avatar_color text,
  avatar_url   text,
  removed_by   uuid references auth.users (id) on delete set null,
  departed_at  timestamptz not null default now(),
  reinvited_by uuid references auth.users (id) on delete set null,
  reinvited_at timestamptz,
  primary key (house_id, user_id)
);
alter table public.house_departures enable row level security;

-- Only the current house admin can see it. Admin powers key off
-- houses.created_by, which moves with transfer_house_admin.
drop policy if exists "house_departures_select" on public.house_departures;
create policy "house_departures_select" on public.house_departures for select to authenticated
  using (house_id in (select id from public.houses where created_by = auth.uid()));
-- No insert/update/delete policies: only the trigger and functions below write.

create or replace function public.record_house_departure()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_kind  text;
  v_name  text;
begin
  -- No signed-in actor means the account itself was deleted (their splits and
  -- bill portions are deleted with it). No house row means the whole house
  -- was deleted (the cascade runs after the house row is already gone).
  if v_actor is null then
    return old;
  end if;
  if not exists (select 1 from public.houses where id = old.house_id) then
    return old;
  end if;
  v_kind := case when v_actor = old.user_id then 'left' else 'removed' end;

  -- Capped: a name is free text the member controls, and nothing they put on
  -- their own profile may make them impossible to remove (a ~4000-character
  -- name would overflow the chat note's length check and abort the delete).
  select left(nullif(btrim(p.name), ''), 60) into v_name from public.profiles p where p.id = old.user_id;

  insert into public.house_departures
    (house_id, user_id, kind, name, avatar_color, avatar_url, removed_by, departed_at, reinvited_by, reinvited_at)
  select old.house_id, old.user_id, v_kind, v_name, p.avatar_color, p.avatar_url,
         case when v_kind = 'removed' then v_actor end, now(), null, null
    from (select 1) one
    left join public.profiles p on p.id = old.user_id
  on conflict (house_id, user_id) do update
    set kind         = excluded.kind,
        name         = excluded.name,
        avatar_color = excluded.avatar_color,
        avatar_url   = excluded.avatar_url,
        removed_by   = excluded.removed_by,
        departed_at  = excluded.departed_at,
        reinvited_by = null,
        reinvited_at = null;

  -- A removal gets the same trail as an admin handover (0040): the feed and
  -- the chat both say it. Best effort: a notice that fails must never block
  -- the removal itself (the departure row above stays mandatory). Leaving
  -- stays as quiet as it always was; the admin gets a push instead.
  if v_kind = 'removed' then
    begin
      insert into public.activity (house_id, user_id, type, message)
      values (old.house_id, v_actor, 'member_removed',
              'removed ' || coalesce(v_name, 'a housemate') || ' from the house');

      insert into public.messages (house_id, user_id, kind, body)
      values (old.house_id, v_actor, 'system',
              'removed ' || coalesce(v_name, 'a housemate') || ' from the house.');
    exception when others then
      raise warning 'record_house_departure: notice skipped (%)', sqlerrm;
    end;
  end if;

  return old;
end;
$$;

drop trigger if exists trg_record_house_departure on public.house_members;
create trigger trg_record_house_departure
  after delete on public.house_members
  for each row execute function public.record_house_departure();

-- --- 3) 10-minute invite links, made by the admin ---------------------------
create table if not exists public.house_invites (
  code        text primary key,
  house_id    uuid not null references public.houses (id) on delete cascade,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null
);
create index if not exists idx_house_invites_house on public.house_invites (house_id);
alter table public.house_invites enable row level security;
-- No policies: only the SECURITY DEFINER functions here read or write it.

comment on column public.houses.invite_code is
  'Unused since 0046: permanent invite links were retired for 10-minute links in house_invites.';

create or replace function public.create_house_invite(p_house_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_ttl  int := 600; -- seconds: a link works for 10 minutes
  v_exp  timestamptz := now() + make_interval(secs => v_ttl);
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.houses where id = p_house_id and created_by = auth.uid()) then
    raise exception 'invite_not_admin'
      using hint = 'Only the house admin can create invite links.';
  end if;

  -- Housekeeping. Expired links are kept for a week so the join page can say
  -- "expired" rather than "not found", then they go.
  delete from public.house_invites
   where house_id = p_house_id and expires_at < now() - interval '7 days';

  -- 10 hex characters (40 bits) from the strong random source behind
  -- gen_random_uuid(). A link only lives 10 minutes: far too short to guess.
  loop
    v_code := substr(replace(gen_random_uuid()::text, '-', ''), 1, 10);
    begin
      insert into public.house_invites (code, house_id, created_by, expires_at)
      values (v_code, p_house_id, auth.uid(), v_exp);
      exit;
    exception when unique_violation then
      null; -- vanishingly rare: draw another code
    end;
  end loop;

  return jsonb_build_object('code', v_code, 'expires_at', v_exp, 'ttl_seconds', v_ttl);
end;
$$;

-- --- 4) join_house: live links only, and removals stick ---------------------
create or replace function public.join_house(p_invite_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house  public.houses;
  v_is_new int;
  v_kind   text;
  v_reinv  timestamptz;
  v_code   text := lower(trim(p_invite_code));
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Only a live link from create_house_invite. The app keys off DETAIL; the
  -- message is for humans.
  select h.* into v_house
    from public.house_invites i
    join public.houses h on h.id = i.house_id
   where i.code = v_code and i.expires_at > now();

  if v_house.id is null then
    if exists (select 1 from public.house_invites where code = v_code) then
      raise exception 'This invite link has expired. Ask the house admin for a new one.'
        using detail = 'invite_expired';
    end if;
    raise exception 'No house found for that invite link'
      using detail = 'invite_not_found';
  end if;

  -- Fast path: a removed person gets a clear answer before anything is written.
  if exists (
    select 1 from public.house_departures d
    where d.house_id = v_house.id and d.user_id = auth.uid()
      and d.kind = 'removed' and d.reinvited_at is null
  ) then
    raise exception 'You were removed from this house. Ask the house admin to invite you back.'
      using detail = 'removed_from_house';
  end if;

  insert into public.house_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'member')
  on conflict (house_id, user_id) do nothing;
  get diagnostics v_is_new = row_count;

  -- Check again AFTER the insert, under a row lock. A removal that lands
  -- while this call runs makes the insert wait for it, so it is visible here,
  -- and the raise rolls the insert back. Without this, someone looping join
  -- calls could slip back in the moment the admin removed them.
  select d.kind, d.reinvited_at into v_kind, v_reinv
    from public.house_departures d
   where d.house_id = v_house.id and d.user_id = auth.uid()
     for update;
  if found and v_kind = 'removed' and v_reinv is null then
    raise exception 'You were removed from this house. Ask the house admin to invite you back.'
      using detail = 'removed_from_house';
  end if;

  -- In the house now: the departure is history, so a later removal starts
  -- afresh. A removal that was never re-invited is never cleared here.
  delete from public.house_departures
   where house_id = v_house.id and user_id = auth.uid()
     and not (kind = 'removed' and reinvited_at is null);

  if v_is_new > 0 then
    insert into public.activity (house_id, user_id, type, message)
    values (v_house.id, auth.uid(), 'member_joined', 'joined the house');
  end if;

  return v_house;
end;
$$;

-- --- 5) The join page's preview ----------------------------------------------
-- A live link shows the house; an expired one only says it expired (no house
-- details, so an old forwarded link doesn't keep revealing the house). removed
-- is about the CALLER only (false for anyone signed out). Adding columns means
-- drop + create; the old app reads only name/member_count/currency.
drop function if exists public.get_house_preview(text);
create function public.get_house_preview(p_invite_code text)
returns table (
  name text, member_count bigint, currency text,
  removed boolean, expires_at timestamptz, expired boolean
)
language sql
security definer
set search_path = public
stable
as $$
  select
    case when l.live then h.name end,
    case when l.live then (select count(*) from public.house_members m where m.house_id = h.id) end,
    case when l.live then h.currency end,
    l.live and exists (
      select 1 from public.house_departures d
      where d.house_id = h.id and d.user_id = auth.uid()
        and d.kind = 'removed' and d.reinvited_at is null
    ),
    i.expires_at,
    not l.live
  from public.house_invites i
  join public.houses h on h.id = i.house_id
  cross join lateral (select i.expires_at > now() as live) l
  where i.code = lower(trim(p_invite_code));
$$;

-- --- 6) The admin invites a removed person back (or changes their mind) -----
create or replace function public.set_house_reinvite(p_house_id uuid, p_user_id uuid, p_invited boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (select 1 from public.houses where id = p_house_id and created_by = auth.uid()) then
    raise exception 'reinvite_not_admin'
      using hint = 'Only the house admin can invite someone back.';
  end if;

  update public.house_departures
     set reinvited_at = case when p_invited then now() else null end,
         reinvited_by = case when p_invited then auth.uid() else null end
   where house_id = p_house_id and user_id = p_user_id and kind = 'removed';
  if not found then
    raise exception 'reinvite_not_removed'
      using hint = 'That person is not on this house''s removed list.';
  end if;
end;
$$;

-- --- 7) Two adjacent holes found while reviewing this -----------------------
-- Feed lines can only be written as yourself. Otherwise any member could post
-- "Alice removed Cat from the house" attributed to the admin. Every app insert
-- already uses the signed-in user's id, and the cron uses the service role.
drop policy if exists "activity_insert" on public.activity;
create policy "activity_insert" on public.activity for insert to authenticated
  with check (house_id in (select public.user_house_ids()) and user_id = auth.uid());

-- Houses are only made by create_house (SECURITY DEFINER, picks its own id).
-- The direct insert policy let a client choose the id, so an ex-member could
-- recreate a deleted house under its old id and read the receipts left in
-- storage under that id. No app code inserts into houses directly.
drop policy if exists "houses_insert" on public.houses;

-- --- 8) Grants ---------------------------------------------------------------
-- Supabase's default privileges hand EXECUTE to anon on every new function,
-- and revoking from PUBLIC alone doesn't undo that, so revoke anon explicitly.
revoke execute on function public.record_house_departure() from public, anon, authenticated;
revoke execute on function public.create_house_invite(uuid) from public, anon;
grant execute on function public.create_house_invite(uuid) to authenticated;
revoke execute on function public.set_house_reinvite(uuid, uuid, boolean) from public, anon;
grant execute on function public.set_house_reinvite(uuid, uuid, boolean) to authenticated;
-- The join page calls the preview for signed-out visitors too.
grant execute on function public.get_house_preview(text) to anon, authenticated;

notify pgrst, 'reload schema';
