-- 0048: the database half of the 28/09/2026 security audit.
--
-- Safe to run before or after the matching app deploy. (The email half of
-- the audit, M9, is 0049: that one must wait for the deploy.)
--
-- 1. Colours (audit M1). Stored colours are drawn in style attributes, so a
--    crafted value could draw a fake full-screen overlay over a housemate's
--    app. Only plain #rrggbb colours are accepted from now on.
-- 2. Notices keep their real author (M3). Whoever posts a notice is its
--    author whatever the request says, the author can't be changed later,
--    and only the author may change its words (anyone may still pin it).
-- 3. System chat notes come from the database only (M3). Members can no
--    longer post kind='system' messages. The notes the app used to post
--    itself are written here instead: house settings changes and settle-up
--    style switches by a trigger, the "house is settled up" note by
--    announce_settled(), which only posts it when it is true.
-- 4. The avatars storage bucket is closed (M4). The app only uses its
--    built-in preset images, but the bucket was public and writable by any
--    signed-in user, i.e. free file hosting on HouseSync's own domain.
-- 5. Logged-out visitors can no longer call the three money functions. They
--    refused anyway, but shouldn't be reachable at all.

-- ---------------------------------------------------------------------------
-- 1. Colours
-- ---------------------------------------------------------------------------
update public.profiles
   set avatar_color = '#6f53f5'
 where avatar_color !~ '^#[0-9A-Fa-f]{6}$';

update public.house_categories
   set color = '#94a3b8'
 where color !~ '^#[0-9A-Fa-f]{6}$';

update public.house_departures
   set avatar_color = null
 where avatar_color !~ '^#[0-9A-Fa-f]{6}$';

alter table public.profiles drop constraint if exists profiles_avatar_color_hex;
alter table public.profiles add constraint profiles_avatar_color_hex
  check (avatar_color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.house_categories drop constraint if exists house_categories_color_hex;
alter table public.house_categories add constraint house_categories_color_hex
  check (color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.house_departures drop constraint if exists house_departures_avatar_color_hex;
alter table public.house_departures add constraint house_departures_avatar_color_hex
  check (avatar_color is null or avatar_color ~ '^#[0-9A-Fa-f]{6}$');

-- ---------------------------------------------------------------------------
-- 2. Notices keep their real author
-- ---------------------------------------------------------------------------
create or replace function public.pin_notice_author()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    -- The poster is the author, whatever the request said. (No signed-in
    -- user means the server or SQL editor, which may set it.)
    if auth.uid() is not null then
      new.posted_by := auth.uid();
    end if;
    return new;
  end if;

  -- An existing notice stays where it is and keeps its author...
  new.posted_by := old.posted_by;
  new.house_id  := old.house_id;
  -- ...and only that author may change what it says. Pinning stays open to
  -- the whole house.
  if auth.uid() is not null
     and auth.uid() is distinct from old.posted_by
     and (new.title is distinct from old.title or new.message is distinct from old.message) then
    raise exception 'notice_author_only' using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_pin_notice_author on public.notices;
create trigger trg_pin_notice_author
  before insert or update on public.notices
  for each row execute function public.pin_notice_author();

-- ---------------------------------------------------------------------------
-- 3. System chat notes come from the database only
-- ---------------------------------------------------------------------------
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (
    house_id in (select public.user_house_ids())
    and user_id = auth.uid()
    and kind = 'user'
  );

-- House settings and settle-up style changes, told to the house in the chat
-- in the same words the app used. Best effort: a note that fails must never
-- block the change itself.
create or replace function public.note_house_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor   uuid := auth.uid();
  v_changes text[] := '{}';
  v_day     int;
begin
  -- Only changes someone made in the app (not maintenance from the server).
  if v_actor is null then
    return null;
  end if;

  if new.name is distinct from old.name then
    v_changes := v_changes || format('renamed the house to “%s”', new.name);
  end if;
  if new.currency is distinct from old.currency then
    v_changes := v_changes || format('changed the house currency to %s (%s)', new.currency,
      case new.currency
        when 'AED' then 'UAE Dirham'
        when 'AUD' then 'Australian Dollar'
        when 'BDT' then 'Bangladeshi Taka'
        when 'BRL' then 'Brazilian Real'
        when 'CAD' then 'Canadian Dollar'
        when 'CHF' then 'Swiss Franc'
        when 'CNY' then 'Chinese Yuan'
        when 'DKK' then 'Danish Krone'
        when 'EUR' then 'Euro'
        when 'GBP' then 'British Pound'
        when 'GHS' then 'Ghanaian Cedi'
        when 'HKD' then 'Hong Kong Dollar'
        when 'INR' then 'Indian Rupee'
        when 'JPY' then 'Japanese Yen'
        when 'KES' then 'Kenyan Shilling'
        when 'KRW' then 'South Korean Won'
        when 'MXN' then 'Mexican Peso'
        when 'MYR' then 'Malaysian Ringgit'
        when 'NGN' then 'Nigerian Naira'
        when 'NOK' then 'Norwegian Krone'
        when 'NZD' then 'New Zealand Dollar'
        when 'PKR' then 'Pakistani Rupee'
        when 'PLN' then 'Polish Zloty'
        when 'QAR' then 'Qatari Riyal'
        when 'SAR' then 'Saudi Riyal'
        when 'SEK' then 'Swedish Krona'
        when 'SGD' then 'Singapore Dollar'
        when 'THB' then 'Thai Baht'
        when 'TRY' then 'Turkish Lira'
        when 'USD' then 'US Dollar'
        when 'ZAR' then 'South African Rand'
        else new.currency
      end);
  end if;
  if new.rent_due_day is distinct from old.rent_due_day then
    v_day := new.rent_due_day;
    v_changes := v_changes || case
      when v_day is null then 'removed the rent day'
      else 'set rent day to the ' || v_day || case
        when v_day % 10 = 1 and v_day % 100 <> 11 then 'st'
        when v_day % 10 = 2 and v_day % 100 <> 12 then 'nd'
        when v_day % 10 = 3 and v_day % 100 <> 13 then 'rd'
        else 'th'
      end
    end;
  end if;
  if new.address_nickname is distinct from old.address_nickname then
    v_changes := v_changes || case
      when new.address_nickname is null then 'removed the address nickname'
      else format('set the address nickname to “%s”', left(new.address_nickname, 100))
    end;
  end if;

  begin
    if cardinality(v_changes) > 0 then
      insert into public.messages (house_id, user_id, kind, body)
      values (new.id, v_actor, 'system', array_to_string(v_changes, ', and ') || '.');
    end if;

    if new.settle_mode is distinct from old.settle_mode then
      insert into public.messages (house_id, user_id, kind, body)
      values (new.id, v_actor, 'system',
        case when new.settle_mode = 'simplified'
          then 'switched the house to simplified settle up. The Housemates tab now shows the fewest payments that clear everyone.'
          else 'switched the house back to itemised settle up. Every debt shows on its own again.'
        end);
    end if;
  exception when others then
    raise warning 'note_house_changes: note skipped (%)', sqlerrm;
  end;

  return null;
end;
$$;

drop trigger if exists trg_note_house_changes on public.houses;
create trigger trg_note_house_changes
  after update of name, currency, rent_due_day, address_nickname, settle_mode on public.houses
  for each row execute function public.note_house_changes();

-- "... confirmed the last payment, the whole house is settled up 🎉", posted
-- by the app straight after its settle_sweep() call succeeds. Only posted
-- while it is true: a simplified house with spending in it, every share
-- confirmed and every payment absorbed (what a sweep leaves behind), and not
-- twice in a row.
create or replace function public.announce_settled(p_house_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_body  constant text := 'confirmed the last payment, the whole house is settled up 🎉';
begin
  if v_actor is null
     or not exists (select 1 from public.house_members
                     where house_id = p_house_id and user_id = v_actor) then
    return false;
  end if;
  if not exists (select 1 from public.houses
                  where id = p_house_id and settle_mode = 'simplified') then
    return false;
  end if;
  if not exists (select 1 from public.expenses where house_id = p_house_id) then
    return false;
  end if;
  if exists (select 1
               from public.expense_splits s
               join public.expenses e on e.id = s.expense_id
              where e.house_id = p_house_id and s.status <> 'confirmed') then
    return false;
  end if;
  if exists (select 1 from public.settlements
              where house_id = p_house_id and not absorbed) then
    return false;
  end if;
  if (select m.body from public.messages m
       where m.house_id = p_house_id
       order by m.created_at desc
       limit 1) is not distinct from v_body then
    return false;
  end if;

  insert into public.messages (house_id, user_id, kind, body)
  values (p_house_id, v_actor, 'system', v_body);
  return true;
end;
$$;

revoke all on function public.announce_settled(uuid) from public, anon;
grant execute on function public.announce_settled(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Close the unused avatars bucket
-- ---------------------------------------------------------------------------
-- Files already in it stay where they are, just no longer public. Empty or
-- delete the bucket from Storage in the dashboard if you want them gone.
-- Supabase owns the storage tables: if the SQL editor isn't allowed to change
-- them, this part is skipped (the rest still applies) and the check row at
-- the bottom shows it, so it can be done in the dashboard instead.
do $$
begin
  update storage.buckets set public = false where id = 'avatars';
  drop policy if exists "avatars_read"   on storage.objects;
  drop policy if exists "avatars_insert" on storage.objects;
  drop policy if exists "avatars_update" on storage.objects;
  drop policy if exists "avatars_delete" on storage.objects;
exception when insufficient_privilege then
  raise warning 'avatars bucket left as it was: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Money functions: signed-in users only
-- ---------------------------------------------------------------------------
revoke execute on function public.pay_itemised(uuid, uuid, numeric) from anon;
revoke execute on function public.rewrite_expense_splits(uuid, jsonb) from anon;
revoke execute on function public.settle_sweep(uuid) from anon;

-- ---------------------------------------------------------------------------
-- Check: one row back, each column named after the value it should show.
-- ---------------------------------------------------------------------------
select
  (select count(*) from pg_constraint
    where conname in ('profiles_avatar_color_hex', 'house_categories_color_hex',
                      'house_departures_avatar_color_hex'))                    as colour_rules_3,
  exists (select 1 from pg_trigger where tgname = 'trg_pin_notice_author')     as notice_authors_true,
  coalesce((select with_check like '%kind%' from pg_policies
             where schemaname = 'public' and tablename = 'messages'
               and policyname = 'messages_insert'), false)                     as system_notes_locked_true,
  exists (select 1 from pg_trigger where tgname = 'trg_note_house_changes')    as house_notes_true,
  coalesce((select public from storage.buckets where id = 'avatars'), false)   as avatars_public_false,
  (select count(*) from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'avatars\_%')                                         as avatars_policies_0,
  (has_function_privilege('anon', 'public.settle_sweep(uuid)', 'execute')
   or has_function_privilege('anon', 'public.pay_itemised(uuid, uuid, numeric)', 'execute')
   or has_function_privilege('anon', 'public.rewrite_expense_splits(uuid, jsonb)', 'execute'))
                                                                                as logged_out_money_false;
