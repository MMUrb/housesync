-- ============================================================================
-- Fix: join_house failed with "operator does not exist: boolean > integer".
-- v_is_new was declared boolean but assigned row_count (an int) and compared
-- with > 0. Declaring it as int fixes joining a house by invite code.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================
create or replace function public.join_house(p_invite_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
  v_is_new int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_house
  from public.houses
  where invite_code = lower(trim(p_invite_code));

  if v_house.id is null then
    raise exception 'No house found for that invite link';
  end if;

  insert into public.house_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'member')
  on conflict (house_id, user_id) do nothing;

  get diagnostics v_is_new = row_count;
  if v_is_new > 0 then
    insert into public.activity (house_id, user_id, type, message)
    values (v_house.id, auth.uid(), 'member_joined', 'joined the house');
  end if;

  return v_house;
end;
$$;
