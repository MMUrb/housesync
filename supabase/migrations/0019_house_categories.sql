-- ============================================================================
-- Per-house expense categories: the house shares one editable list. Members
-- can rename the defaults, recolour them, or add their own (e.g. "Streaming
-- services"). Expenses/bills store a category CODE that resolves against this
-- table. Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.house_categories (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  code       text not null,
  name       text not null,
  emoji      text not null default '📦',
  color      text not null default '#94a3b8',
  sort       int  not null default 0,
  archived   boolean not null default false,
  created_at timestamptz not null default now(),
  unique (house_id, code)
);
create index if not exists idx_house_categories_house on public.house_categories (house_id);

alter table public.house_categories enable row level security;

drop policy if exists "house_categories_select" on public.house_categories;
create policy "house_categories_select" on public.house_categories for select to authenticated
  using (house_id in (select public.user_house_ids()));
drop policy if exists "house_categories_insert" on public.house_categories;
create policy "house_categories_insert" on public.house_categories for insert to authenticated
  with check (house_id in (select public.user_house_ids()));
drop policy if exists "house_categories_update" on public.house_categories;
create policy "house_categories_update" on public.house_categories for update to authenticated
  using (house_id in (select public.user_house_ids())) with check (house_id in (select public.user_house_ids()));
drop policy if exists "house_categories_delete" on public.house_categories;
create policy "house_categories_delete" on public.house_categories for delete to authenticated
  using (house_id in (select public.user_house_ids()));

-- Custom codes can now be stored on expenses + recurring bills.
alter table public.expenses drop constraint if exists expenses_category_check;
alter table public.recurring_bills drop constraint if exists recurring_bills_category_check;

-- Seed the default category set for a house.
create or replace function public.seed_house_categories(p_house uuid)
returns void language sql security definer set search_path = public as $$
  insert into public.house_categories (house_id, code, name, emoji, color, sort) values
    (p_house, 'rent', 'Rent', '🏠', '#6f53f5', 1),
    (p_house, 'bills', 'Bills', '💡', '#3f9fe0', 2),
    (p_house, 'groceries', 'Groceries', '🛒', '#1bb27e', 3),
    (p_house, 'streaming', 'Streaming services', '🎬', '#e0567f', 4),
    (p_house, 'cleaning', 'Cleaning', '🧽', '#e0b53f', 5),
    (p_house, 'furniture', 'Furniture', '🛋️', '#9b5fe0', 6),
    (p_house, 'other', 'Other', '📦', '#94a3b8', 7)
  on conflict (house_id, code) do nothing;
$$;

-- Auto-seed when a new house is created.
create or replace function public.handle_new_house()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.seed_house_categories(new.id);
  return new;
end;
$$;
drop trigger if exists on_house_created on public.houses;
create trigger on_house_created after insert on public.houses
  for each row execute function public.handle_new_house();

-- Backfill every existing house.
do $$
declare h record;
begin
  for h in select id from public.houses loop
    perform public.seed_house_categories(h.id);
  end loop;
end $$;
