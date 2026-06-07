-- ============================================================================
-- HouseSync database schema
-- ----------------------------------------------------------------------------
-- Run this whole file once in the Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New query -> paste -> Run).
-- It is safe to re-run: it uses IF NOT EXISTS / CREATE OR REPLACE and
-- recreates policies each time.
-- ============================================================================

-- Needed for gen_random_uuid() (enabled by default on Supabase, but be safe).
create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

-- One row per user, mirroring auth.users with app-level profile fields.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text,
  email        text,
  avatar_color text not null default '#6f53f5',
  created_at   timestamptz not null default now()
);

-- A shared house / flat.
create table if not exists public.houses (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  currency         text not null default 'GBP',
  rent_due_day     int check (rent_due_day between 1 and 31),
  address_nickname text,
  invite_code      text not null unique default lower(substr(md5(random()::text), 1, 8)),
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Membership: which users belong to which houses.
create table if not exists public.house_members (
  id            uuid primary key default gen_random_uuid(),
  house_id      uuid not null references public.houses (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member')),
  move_in_date  date,
  move_out_date date,
  joined_at     timestamptz not null default now(),
  unique (house_id, user_id)
);

-- A one-off shared expense.
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  house_id    uuid not null references public.houses (id) on delete cascade,
  title       text not null,
  amount      numeric(12, 2) not null check (amount >= 0),
  category    text not null default 'other'
                check (category in ('rent', 'bills', 'groceries', 'cleaning', 'furniture', 'other')),
  paid_by     uuid references auth.users (id) on delete set null,
  split_type  text not null default 'equal'
                check (split_type in ('equal', 'custom', 'percentage')),
  date        date not null default current_date,
  receipt_url text,
  notes       text,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Who owes what for a given expense (one row per participant).
create table if not exists public.expense_splits (
  id           uuid primary key default gen_random_uuid(),
  expense_id   uuid not null references public.expenses (id) on delete cascade,
  user_id      uuid not null references auth.users (id) on delete cascade,
  amount_owed  numeric(12, 2) not null default 0,
  status       text not null default 'unpaid' check (status in ('unpaid', 'paid', 'confirmed')),
  paid_at      timestamptz,
  confirmed_at timestamptz,
  unique (expense_id, user_id)
);

-- Recurring bills (rent, wi-fi, energy, water, council tax...).
create table if not exists public.recurring_bills (
  id               uuid primary key default gen_random_uuid(),
  house_id         uuid not null references public.houses (id) on delete cascade,
  title            text not null,
  amount           numeric(12, 2) not null check (amount >= 0),
  category         text not null default 'bills'
                     check (category in ('rent', 'bills', 'groceries', 'cleaning', 'furniture', 'other')),
  frequency        text not null default 'monthly'
                     check (frequency in ('weekly', 'monthly', 'quarterly', 'yearly')),
  due_day          int check (due_day between 1 and 31),
  next_due_date    date,
  paid_by          uuid references auth.users (id) on delete set null,
  split_type       text not null default 'equal'
                     check (split_type in ('equal', 'custom', 'percentage')),
  reminder_enabled boolean not null default true,
  active           boolean not null default true,
  created_by       uuid references auth.users (id) on delete set null,
  created_at       timestamptz not null default now()
);

-- Household chores / rota.
create table if not exists public.chores (
  id           uuid primary key default gen_random_uuid(),
  house_id     uuid not null references public.houses (id) on delete cascade,
  title        text not null,
  assigned_to  uuid references auth.users (id) on delete set null,
  due_date     date,
  repeat       text not null default 'once'
                 check (repeat in ('once', 'weekly', 'fortnightly', 'monthly')),
  status       text not null default 'todo' check (status in ('todo', 'done', 'missed')),
  completed_at timestamptz,
  completed_by uuid references auth.users (id) on delete set null,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now()
);

-- House timeline / history.
create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  user_id    uuid references auth.users (id) on delete set null,
  type       text not null default 'note',
  message    text not null,
  created_at timestamptz not null default now()
);

-- Simple shared noticeboard.
create table if not exists public.notices (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  title      text not null,
  message    text,
  posted_by  uuid references auth.users (id) on delete set null,
  pinned     boolean not null default false,
  created_at timestamptz not null default now()
);

-- Helpful indexes.
create index if not exists idx_house_members_user on public.house_members (user_id);
create index if not exists idx_house_members_house on public.house_members (house_id);
create index if not exists idx_expenses_house on public.expenses (house_id);
create index if not exists idx_expense_splits_expense on public.expense_splits (expense_id);
create index if not exists idx_expense_splits_user on public.expense_splits (user_id);
create index if not exists idx_bills_house on public.recurring_bills (house_id);
create index if not exists idx_chores_house on public.chores (house_id);
create index if not exists idx_activity_house on public.activity (house_id);
create index if not exists idx_notices_house on public.notices (house_id);

-- ----------------------------------------------------------------------------
-- HELPER: which houses does the current user belong to?
-- SECURITY DEFINER so it bypasses RLS and avoids infinite recursion when used
-- inside the house_members policies themselves.
-- ----------------------------------------------------------------------------
create or replace function public.user_house_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select house_id from public.house_members where user_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- NEW USER -> PROFILE
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array['#6f53f5','#1bb27e','#f5953f','#e0567f','#3f9fe0','#9b5fe0','#e0b53f','#3fcdad'];
begin
  insert into public.profiles (id, name, email, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    palette[1 + (('x' || substr(md5(new.id::text), 1, 8))::bit(32)::int % array_length(palette, 1))]
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- RPC: create a house and add the creator as admin (atomic).
-- ----------------------------------------------------------------------------
create or replace function public.create_house(
  p_name text,
  p_currency text default 'GBP',
  p_rent_due_day int default null,
  p_address_nickname text default null
)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.houses (name, currency, rent_due_day, address_nickname, created_by)
  values (nullif(trim(p_name), ''), coalesce(p_currency, 'GBP'), p_rent_due_day, nullif(trim(p_address_nickname), ''), auth.uid())
  returning * into v_house;

  insert into public.house_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin')
  on conflict (house_id, user_id) do nothing;

  insert into public.activity (house_id, user_id, type, message)
  values (v_house.id, auth.uid(), 'house_created', 'created the house');

  return v_house;
end;
$$;

-- ----------------------------------------------------------------------------
-- RPC: join a house using its invite code (atomic, bypasses RLS safely).
-- ----------------------------------------------------------------------------
create or replace function public.join_house(p_invite_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
  v_is_new boolean;
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

-- ----------------------------------------------------------------------------
-- RPC: preview a house from an invite code (name + member count only) so the
-- join screen can show what you're joining without exposing the houses table.
-- ----------------------------------------------------------------------------
create or replace function public.get_house_preview(p_invite_code text)
returns table (name text, member_count bigint, currency text)
language sql
security definer
set search_path = public
stable
as $$
  select
    h.name,
    (select count(*) from public.house_members m where m.house_id = h.id) as member_count,
    h.currency
  from public.houses h
  where h.invite_code = lower(trim(p_invite_code));
$$;

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.houses         enable row level security;
alter table public.house_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_splits enable row level security;
alter table public.recurring_bills enable row level security;
alter table public.chores         enable row level security;
alter table public.activity       enable row level security;
alter table public.notices        enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or id in (select hm.user_id from public.house_members hm where hm.house_id in (select public.user_house_ids()))
  );

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- houses --------------------------------------------------------------------
drop policy if exists "houses_select" on public.houses;
create policy "houses_select" on public.houses for select to authenticated
  using (id in (select public.user_house_ids()));

drop policy if exists "houses_insert" on public.houses;
create policy "houses_insert" on public.houses for insert to authenticated
  with check (created_by = auth.uid());

drop policy if exists "houses_update" on public.houses;
create policy "houses_update" on public.houses for update to authenticated
  using (id in (select public.user_house_ids()))
  with check (id in (select public.user_house_ids()));

drop policy if exists "houses_delete" on public.houses;
create policy "houses_delete" on public.houses for delete to authenticated
  using (created_by = auth.uid());

-- house_members -------------------------------------------------------------
drop policy if exists "members_select" on public.house_members;
create policy "members_select" on public.house_members for select to authenticated
  using (house_id in (select public.user_house_ids()));

drop policy if exists "members_insert" on public.house_members;
create policy "members_insert" on public.house_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "members_update" on public.house_members;
create policy "members_update" on public.house_members for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "members_delete" on public.house_members;
create policy "members_delete" on public.house_members for delete to authenticated
  using (
    user_id = auth.uid()
    or house_id in (select id from public.houses where created_by = auth.uid())
  );

-- expenses ------------------------------------------------------------------
drop policy if exists "expenses_select" on public.expenses;
create policy "expenses_select" on public.expenses for select to authenticated
  using (house_id in (select public.user_house_ids()));

drop policy if exists "expenses_insert" on public.expenses;
create policy "expenses_insert" on public.expenses for insert to authenticated
  with check (house_id in (select public.user_house_ids()) and created_by = auth.uid());

drop policy if exists "expenses_update" on public.expenses;
create policy "expenses_update" on public.expenses for update to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));

drop policy if exists "expenses_delete" on public.expenses;
create policy "expenses_delete" on public.expenses for delete to authenticated
  using (house_id in (select public.user_house_ids()));

-- expense_splits ------------------------------------------------------------
drop policy if exists "splits_all" on public.expense_splits;
create policy "splits_all" on public.expense_splits for all to authenticated
  using (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and e.house_id in (select public.user_house_ids())
    )
  )
  with check (
    exists (
      select 1 from public.expenses e
      where e.id = expense_splits.expense_id
        and e.house_id in (select public.user_house_ids())
    )
  );

-- recurring_bills -----------------------------------------------------------
drop policy if exists "bills_all" on public.recurring_bills;
create policy "bills_all" on public.recurring_bills for all to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));

-- chores --------------------------------------------------------------------
drop policy if exists "chores_all" on public.chores;
create policy "chores_all" on public.chores for all to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));

-- activity ------------------------------------------------------------------
drop policy if exists "activity_select" on public.activity;
create policy "activity_select" on public.activity for select to authenticated
  using (house_id in (select public.user_house_ids()));

drop policy if exists "activity_insert" on public.activity;
create policy "activity_insert" on public.activity for insert to authenticated
  with check (house_id in (select public.user_house_ids()));

-- notices -------------------------------------------------------------------
drop policy if exists "notices_all" on public.notices;
create policy "notices_all" on public.notices for all to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));

-- ----------------------------------------------------------------------------
-- STORAGE: receipts bucket (public read, authenticated write)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "receipts_read" on storage.objects;
create policy "receipts_read" on storage.objects for select
  using (bucket_id = 'receipts');

drop policy if exists "receipts_insert" on storage.objects;
create policy "receipts_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'receipts');

drop policy if exists "receipts_update" on storage.objects;
create policy "receipts_update" on storage.objects for update to authenticated
  using (bucket_id = 'receipts');

drop policy if exists "receipts_delete" on storage.objects;
create policy "receipts_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'receipts');

-- Done.
