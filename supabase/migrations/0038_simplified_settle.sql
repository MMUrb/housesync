-- 0038: Simplified settle up.
-- Adds a house-wide settle mode (itemised = today's per-debt flow, simplified =
-- fewest-payments netting) and a settlements ledger. In simplified mode a
-- payment is its own row here rather than a status flip on expense_splits,
-- which is what lets one transfer clear debts to several people at once.
--
-- "absorbed" marks settlements that have been reconciled into split statuses:
-- when the whole house reaches zero, every open split is confirmed and every
-- settlement flagged absorbed in one sweep, so neither side is double-counted.

alter table public.houses
  add column if not exists settle_mode text not null default 'itemised';

alter table public.houses
  drop constraint if exists houses_settle_mode_check;
alter table public.houses
  add constraint houses_settle_mode_check
  check (settle_mode in ('itemised', 'simplified'));

create table if not exists public.settlements (
  id           uuid primary key default gen_random_uuid(),
  house_id     uuid not null references public.houses(id) on delete cascade,
  from_user    uuid not null references auth.users(id) on delete cascade,
  to_user      uuid not null references auth.users(id) on delete cascade,
  amount       numeric(10,2) not null check (amount > 0),
  status       text not null default 'pending' check (status in ('pending', 'confirmed')),
  absorbed     boolean not null default false,
  created_at   timestamptz not null default now(),
  confirmed_at timestamptz,
  check (from_user <> to_user)
);

create index if not exists idx_settlements_house on public.settlements (house_id);

alter table public.settlements enable row level security;

-- Same trust model as expense_splits: any member of the house can read and
-- write its settlement rows (the app is a shared household ledger, and the
-- existing splits policy already grants house-wide mutation).
drop policy if exists "settlements_all" on public.settlements;
create policy "settlements_all" on public.settlements for all to authenticated
  using (house_id in (select public.user_house_ids()))
  with check (house_id in (select public.user_house_ids()));
