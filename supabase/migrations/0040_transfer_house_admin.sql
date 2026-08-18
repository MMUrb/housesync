-- 0040: Transfer house admin.
--
-- houses.created_by is the house owner (delete house, remove members, settle
-- mode) and house_members.role = 'admin' is the visible tag; in practice they
-- are always the same person because the only way to become admin is to
-- create the house. This RPC hands BOTH to another member atomically.
--
-- The pin_house_owner / pin_member_role triggers exist precisely so nobody can
-- change these columns with a plain UPDATE. Rather than disable them (DDL
-- inside a function, heavy locks), the RPC sets a transaction-local flag that
-- the triggers honour. Only this SECURITY DEFINER function sets the flag,
-- after checking the caller is the current owner, so a client can never reach
-- the bypass on its own.

create or replace function public.pin_house_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('housesync.allow_admin_transfer', true) is distinct from 'on' then
    new.created_by := old.created_by;
  end if;
  new.invite_code := old.invite_code;
  return new;
end;
$$;

create or replace function public.pin_member_role()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('housesync.allow_admin_transfer', true) is distinct from 'on' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

create or replace function public.transfer_house_admin(p_house_id uuid, p_new_admin uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner    uuid;
  v_new_name text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  -- Lock the house row so two transfers (or a transfer and a leave) serialise.
  select created_by into v_owner from public.houses where id = p_house_id for update;
  if v_owner is null then
    raise exception 'house_not_found';
  end if;
  if v_owner <> auth.uid() then
    raise exception 'transfer_not_admin'
      using hint = 'Only the current house admin can hand over the role.';
  end if;
  if p_new_admin = auth.uid() then
    raise exception 'transfer_same_person'
      using hint = 'You are already the admin.';
  end if;
  if not exists (
    select 1 from public.house_members where house_id = p_house_id and user_id = p_new_admin
  ) then
    raise exception 'transfer_not_member'
      using hint = 'That person is not in this house any more.';
  end if;

  perform set_config('housesync.allow_admin_transfer', 'on', true);

  update public.houses set created_by = p_new_admin where id = p_house_id;
  update public.house_members set role = 'member'
   where house_id = p_house_id and user_id = auth.uid();
  update public.house_members set role = 'admin'
   where house_id = p_house_id and user_id = p_new_admin;

  select name into v_new_name from public.profiles where id = p_new_admin;

  insert into public.activity (house_id, user_id, type, message)
  values (p_house_id, auth.uid(), 'admin_transferred',
          'made ' || coalesce(v_new_name, 'a housemate') || ' the house admin');

  insert into public.messages (house_id, user_id, kind, body)
  values (p_house_id, auth.uid(), 'system',
          'made ' || coalesce(v_new_name, 'a housemate') || ' the house admin.');
end;
$$;

revoke all on function public.transfer_house_admin(uuid, uuid) from public;
grant execute on function public.transfer_house_admin(uuid, uuid) to authenticated;
