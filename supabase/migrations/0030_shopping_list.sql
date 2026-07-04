-- ============================================================================
-- Shared shopping / grocery list.
--
-- A house-scoped checklist: any housemate can add items, tick them off (which
-- records who got it and when) and clear bought items. Mirrors the notices /
-- chores model exactly: RLS gates every row to the caller's houses, and the
-- table is added to the supabase_realtime publication so a tick by one
-- housemate streams to everyone via the shared house channel.
--
-- IMPORTANT: run this BEFORE deploying the code that binds `shopping_items` in
-- HouseRealtime. Supabase errors the WHOLE house Realtime channel if any one
-- bound table is missing from the publication (see 0027), which would silently
-- kill live sync for chat, expenses, chores, everything. Run once in the
-- Supabase SQL Editor; safe to re-run.
-- ============================================================================

create table if not exists public.shopping_items (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  name       text not null,
  quantity   text,
  checked    boolean not null default false,
  added_by   uuid references auth.users (id) on delete set null,
  checked_by uuid references auth.users (id) on delete set null,
  checked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_shopping_items_house on public.shopping_items (house_id);

alter table public.shopping_items enable row level security;

drop policy if exists "shopping_items_all" on public.shopping_items;
create policy "shopping_items_all" on public.shopping_items for all to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));

-- Live sync via the shared house channel.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items'
  ) then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
end $$;
