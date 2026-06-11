-- ============================================================================
-- Payment handles move off profiles into their own table with a consent
-- switch. "Only me" is enforced by the DATABASE, not just the UI: housemates
-- can only SELECT a row while share_with_house is true (the owner always can).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.payment_details (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  monzo            text,
  paypal           text,
  revolut          text,
  bank             text,
  share_with_house boolean not null default true,
  updated_at       timestamptz not null default now()
);

alter table public.payment_details enable row level security;

drop policy if exists "payment_details_select" on public.payment_details;
create policy "payment_details_select" on public.payment_details for select to authenticated
  using (
    user_id = auth.uid()
    or (
      share_with_house
      and user_id in (
        select hm.user_id from public.house_members hm
        where hm.house_id in (select public.user_house_ids())
      )
    )
  );

drop policy if exists "payment_details_insert" on public.payment_details;
create policy "payment_details_insert" on public.payment_details for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "payment_details_update" on public.payment_details;
create policy "payment_details_update" on public.payment_details for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "payment_details_delete" on public.payment_details;
create policy "payment_details_delete" on public.payment_details for delete to authenticated
  using (user_id = auth.uid());

-- Carry existing handles over. Everyone who added them did so to be seen by
-- the house, so sharing starts ON (they can flip it off in Settings).
insert into public.payment_details (user_id, monzo, paypal, revolut, bank)
select id, pay_monzo, pay_paypal, pay_revolut, pay_bank
from public.profiles
where coalesce(pay_monzo, pay_paypal, pay_revolut, pay_bank) is not null
on conflict (user_id) do nothing;

-- Clear the old loose columns so no second copy lingers on profiles (they're
-- readable by housemates regardless of the new consent switch). The columns
-- themselves can be dropped in a later cleanup once nothing references them.
update public.profiles
set pay_monzo = null, pay_paypal = null, pay_revolut = null, pay_bank = null
where coalesce(pay_monzo, pay_paypal, pay_revolut, pay_bank) is not null;
