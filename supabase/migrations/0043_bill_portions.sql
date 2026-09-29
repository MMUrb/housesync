-- 0043: bill portions + reminder schedules.
--
-- "Give out the portions once, then the app does the monthly legwork."
-- - bill_splits stores each person's portion of a recurring bill (in pounds
--   or percent), set only by the bill's payer. A bill with a valid set sends
--   itself each cycle: the cron creates the expense from these portions and
--   tells every housemate their own number. No portions = the manual flow
--   exactly as before. Portions NEVER change except by the payer's hand.
-- - recurring_bills.reminder_days is the per-bill schedule (days before the
--   due date). The earliest day sends the portions / asks the payer; later
--   days only chase whoever hasn't paid.
-- - expenses.nudge_after_days is the per-expense quiet-nudge delay (was a
--   fixed 7 days for everything). NULL means never.
--
-- Run BEFORE deploying the code that reads these (additive, so the live app
-- is unaffected in the meantime).

alter table public.recurring_bills
  add column if not exists reminder_days int[] not null default '{3,0}'
  check (reminder_days <@ '{7,3,1,0}'::int[]);

alter table public.expenses
  add column if not exists nudge_after_days int default 7
  check (nudge_after_days is null or nudge_after_days between 1 and 60);

create table if not exists public.bill_splits (
  bill_id    uuid not null references public.recurring_bills (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  share_type text not null check (share_type in ('amount', 'percent')),
  value      numeric(12, 2) not null check (value >= 0),
  created_at timestamptz not null default now(),
  primary key (bill_id, user_id)
);
create index if not exists idx_bill_splits_bill on public.bill_splits (bill_id);

alter table public.bill_splits enable row level security;

-- The whole house can SEE portions (they appear on the bill card); only the
-- bill's payer (creator when no payer is set) can write them.
drop policy if exists "bill_splits_select" on public.bill_splits;
create policy "bill_splits_select" on public.bill_splits for select to authenticated
  using (
    bill_id in (
      select b.id from public.recurring_bills b
      where b.house_id in (select public.user_house_ids())
    )
  );

drop policy if exists "bill_splits_write" on public.bill_splits;
create policy "bill_splits_write" on public.bill_splits for all to authenticated
  using (
    bill_id in (
      select b.id from public.recurring_bills b
      where b.house_id in (select public.user_house_ids())
        and coalesce(b.paid_by, b.created_by) = auth.uid()
    )
  )
  with check (
    bill_id in (
      select b.id from public.recurring_bills b
      where b.house_id in (select public.user_house_ids())
        and coalesce(b.paid_by, b.created_by) = auth.uid()
    )
  );
