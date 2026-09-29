-- 0045: bill cycle guards (second to fourth reviews of the bill-portions engine).
--
-- 0044 is live. This follows up on what the reviews found:
-- 1. Every bill cycle records the period it covers (cycle_due, cycle_next)
--    and the frequency it was made under, set only by create_bill_cycle and
--    pinned against edits. Before, the one-per-due-date guard used
--    expenses.date, which any member can edit, so re-dating a cycle could
--    silently skip the next one.
-- 2. A cycle is refused when it would bill mostly the same period as one
--    that already went out, engine or manual, whatever its frequency. The
--    engine says so and either skips it (it was mostly billed already) or
--    starts it when the billed period runs out (it would have re-billed
--    that period); a manual request is refused. That closes double billing
--    after the due date or frequency is changed by hand, without losing
--    the unbilled months. A manual request records exactly one period and
--    can't reach further ahead than the next occurrence.
-- 3. create_bill_cycle also compare-and-swaps the payer and the portions the
--    caller built its shares from, so a stale page or the cron's morning
--    snapshot can never bill old numbers or bill on behalf of an old payer.
-- 4. Only create_bill_cycle can create cycles or record their periods, and
--    only the daily job (service role) can create the engine's cycles.
-- 5. set_bill_portions refuses anything but a JSON array (only [] clears).
-- 6. Who pays a bill is paid_by, full stop. The old fallback to created_by
--    meant a payer who deleted their account silently handed the bill (and
--    everyone's debts) to its creator; now the bill says it needs a new payer.
--    Existing rows with no paid_by get their creator written in first, so
--    nothing changes for them.
-- 7. A bill with portions can't be billed as an equal split.
--
-- Run BEFORE deploying the code that calls the new create_bill_cycle.
-- Nothing live calls it yet, so replacing its signature is safe.

-- ---------------------------------------------------------------------------
-- paid_by is the payer (no more created_by fallback)
-- ---------------------------------------------------------------------------
-- One-off: only while 0044's trigger (which compares coalesce(paid_by,
-- created_by)) is still in place, so the effective payer doesn't change and
-- no portions are cleared. A later re-run of this file must never do it
-- again: by then a null paid_by means the payer deleted their account.
do $$
begin
  if to_regprocedure('public.clear_portions_on_payer_change()') is not null
     and position('coalesce' in pg_get_functiondef('public.clear_portions_on_payer_change()'::regprocedure)) > 0 then
    update public.recurring_bills
       set paid_by = created_by
     where paid_by is null and created_by is not null;
  end if;
end;
$$;

drop policy if exists "bill_splits_write" on public.bill_splits;
create policy "bill_splits_write" on public.bill_splits for all to authenticated
  using (
    bill_id in (
      select b.id from public.recurring_bills b
      where b.house_id in (select public.user_house_ids())
        and b.paid_by = auth.uid()
    )
  )
  with check (
    bill_id in (
      select b.id from public.recurring_bills b
      where b.house_id in (select public.user_house_ids())
        and b.paid_by = auth.uid()
    )
  );

-- A new payer (including none, when the payer deleted their account) starts
-- from manual: the old payer's portions are cleared. SECURITY DEFINER so the
-- clear happens whoever makes the edit.
create or replace function public.clear_portions_on_payer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid_by is distinct from old.paid_by then
    delete from public.bill_splits where bill_id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function public.clear_portions_on_payer_change() from public, anon, authenticated;

drop trigger if exists trg_clear_portions_on_payer_change on public.recurring_bills;
create trigger trg_clear_portions_on_payer_change
  after update of paid_by on public.recurring_bills
  for each row execute function public.clear_portions_on_payer_change();

-- ---------------------------------------------------------------------------
-- The period each bill cycle covers
-- ---------------------------------------------------------------------------
-- cycle_due / cycle_next / cycle_frequency: the period a cycle bills and the
-- frequency it was made under. Always set for the engine's cycles (auto),
-- and for manual Request cycles too, so a date moved back by hand can't bill
-- a period twice either way. Only create_bill_cycle writes them.
alter table public.expenses add column if not exists cycle_due date;
alter table public.expenses add column if not exists cycle_next date;
alter table public.expenses add column if not exists cycle_frequency text;

-- No engine cycles exist in production yet; this only tidies up a stray row,
-- using its bill's real frequency.
update public.expenses e
   set cycle_due = e."date",
       cycle_frequency = coalesce(b.frequency, 'monthly'),
       cycle_next = (e."date" + case coalesce(b.frequency, 'monthly')
                                  when 'weekly' then interval '7 days'
                                  when 'quarterly' then interval '3 months'
                                  when 'yearly' then interval '1 year'
                                  else interval '1 month' end)::date
  from public.recurring_bills b
 where e.auto_cycle and e.cycle_due is null and b.id = e.bill_id;
-- (and one whose bill is gone, so the rule below can be added)
update public.expenses
   set cycle_due = "date",
       cycle_frequency = 'monthly',
       cycle_next = ("date" + interval '1 month')::date
 where auto_cycle and cycle_due is null;

alter table public.expenses drop constraint if exists expenses_auto_cycle_period;
alter table public.expenses add constraint expenses_auto_cycle_period check (
  (cycle_due is null and cycle_next is null and cycle_frequency is null and not auto_cycle)
  or (cycle_due is not null and cycle_next is not null and cycle_next > cycle_due
      and cycle_frequency in ('weekly', 'monthly', 'quarterly', 'yearly'))
);

-- One engine cycle per bill per due date, keyed on the pinned due date.
-- (New name: "if not exists" would keep 0044's date-keyed definition.)
drop index if exists public.expenses_auto_cycle_once;
create unique index if not exists expenses_auto_cycle_due_once
  on public.expenses (bill_id, cycle_due)
  where auto_cycle and bill_id is not null;

create index if not exists idx_expenses_bill_cycle
  on public.expenses (bill_id, cycle_due)
  where cycle_due is not null;

-- Only create_bill_cycle may create cycles (engine or manual) or record the
-- period they cover: it sets this flag for the length of its own
-- transaction. Anyone else writing these would be able to block or fake
-- billing periods.
create or replace function public.guard_auto_cycle_insert()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if (new.auto_cycle or new.cycle_due is not null or new.cycle_next is not null or new.cycle_frequency is not null)
     and coalesce(current_setting('housesync.bill_cycle', true), '') <> 'on' then
    raise exception 'auto_cycle_insert_denied';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_auto_cycle_insert on public.expenses;
create trigger trg_guard_auto_cycle_insert
  before insert on public.expenses
  for each row execute function public.guard_auto_cycle_insert();

-- Editing an expense (its date, amount, title...) never changes which bill
-- period it covers, or turns one kind of expense into another.
create or replace function public.pin_auto_cycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.auto_cycle := old.auto_cycle;
  new.cycle_due := old.cycle_due;
  new.cycle_next := old.cycle_next;
  new.cycle_frequency := old.cycle_frequency;
  return new;
end;
$$;

drop trigger if exists trg_pin_auto_cycle on public.expenses;
create trigger trg_pin_auto_cycle
  before update of auto_cycle, cycle_due, cycle_next, cycle_frequency on public.expenses
  for each row execute function public.pin_auto_cycle();

revoke all on function public.guard_auto_cycle_insert() from public, anon, authenticated;
revoke all on function public.pin_auto_cycle() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_bill_cycle, with payer + portions compare-and-swap and period guard
-- ---------------------------------------------------------------------------
-- The old signature must go first: two overloads make PostgREST refuse to
-- choose (PGRST203).
drop function if exists public.create_bill_cycle(uuid, date, date, date, jsonb, boolean, text, int, text, uuid);

-- p_expected_due / p_expected_payer / p_expected_portions: the bill's
-- next_due_date, payer, and bill_splits rows ([{user_id, share_type, value}],
-- [] for none) exactly as the caller saw them. Any difference from the locked
-- row means the caller's shares may be wrong: nothing is written, 'stale'.
-- p_next_due: where next_due_date moves once this cycle exists; for an engine
-- cycle it is also the end of the period the cycle covers.
create or replace function public.create_bill_cycle(
  p_bill_id uuid,
  p_expected_due date,
  p_expected_payer uuid,
  p_expected_portions jsonb,
  p_expense_date date,
  p_next_due date,
  p_rows jsonb,
  p_auto boolean,
  p_split_type text,
  p_nudge_after_days int,
  p_notes text,
  p_actor uuid
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.recurring_bills;
  v_payer uuid;
  v_creator uuid := coalesce(auth.uid(), p_actor);
  v_total numeric := 0;
  v_rows int;
  v_expense_id uuid;
  v_clash date;
  v_clash_next date;
  v_clash_most boolean;
  v_roll date;
  v_start date;
  v_end date;
  v_period int;
  v_now timestamptz := now();
  r jsonb;
begin
  -- Engine cycles are made by the daily job alone (the service role, which
  -- has no signed-in user). A member calling this directly with p_auto could
  -- otherwise pin any period they like and block the bill.
  if p_auto and auth.uid() is not null then
    raise exception 'cycle_auto_engine_only';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'cycle_no_rows';
  end if;
  if p_expected_portions is null or jsonb_typeof(p_expected_portions) <> 'array' then
    raise exception 'cycle_no_expected_portions';
  end if;
  if p_expense_date is null then
    raise exception 'cycle_no_date';
  end if;
  -- The period ends after it starts, and no single cycle covers more than
  -- about a year (the longest frequency).
  if p_next_due is null or p_next_due <= p_expense_date then
    raise exception 'cycle_bad_next';
  end if;
  if p_auto and p_next_due - p_expense_date > 400 then
    raise exception 'cycle_bad_next';
  end if;
  if p_split_type not in ('equal', 'custom') then
    raise exception 'cycle_bad_split_type';
  end if;
  if v_creator is null then
    raise exception 'cycle_no_actor';
  end if;

  -- Lock the bill: two callers for the same bill queue here, and so do
  -- set_bill_portions and any edit of the bill row.
  select * into v_bill from public.recurring_bills where id = p_bill_id for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  -- Serialise against pay_itemised, rewrite_expense_splits, settle_sweep and
  -- settle-mode switches, like every other split writer.
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || v_bill.house_id::text));

  v_payer := v_bill.paid_by;

  -- The bill moved on since the caller looked: write nothing.
  if v_bill.next_due_date is distinct from p_expected_due then
    return jsonb_build_object('status', 'stale', 'reason', 'due', 'next_due_date', v_bill.next_due_date);
  end if;
  if p_expected_payer is distinct from v_payer then
    return jsonb_build_object('status', 'stale', 'reason', 'payer', 'next_due_date', v_bill.next_due_date);
  end if;
  if exists (
    (select user_id, share_type, value from public.bill_splits where bill_id = p_bill_id
     except
     select (e->>'user_id')::uuid, e->>'share_type', round((e->>'value')::numeric, 2)
       from jsonb_array_elements(p_expected_portions) e)
    union all
    (select (e->>'user_id')::uuid, e->>'share_type', round((e->>'value')::numeric, 2)
       from jsonb_array_elements(p_expected_portions) e
     except
     select user_id, share_type, value from public.bill_splits where bill_id = p_bill_id)
  ) then
    return jsonb_build_object('status', 'stale', 'reason', 'portions', 'next_due_date', v_bill.next_due_date);
  end if;

  -- A bill with portions in a shared house is split by them, even while they
  -- need fixing: an equal split would bill people the wrong amounts. (The
  -- payer can switch the bill back to manual to split it equally.) A solo
  -- house with leftover rows is exempt: there the payer covers it all.
  if p_split_type = 'equal'
     and exists (select 1 from public.bill_splits where bill_id = p_bill_id)
     and (select count(*) from public.house_members where house_id = v_bill.house_id) > 1 then
    raise exception 'cycle_bill_has_portions';
  end if;

  -- The period this cycle covers. An engine cycle: exactly its due date to
  -- the next. A manual request: ONE period of the bill's frequency, from the
  -- date it was due (or today). It bills one period's amount, so it never
  -- claims more, even when the bill was long overdue; and it can't reach
  -- further ahead than the next occurrence (plus a few days' slack), so
  -- nobody can pin a long period to block the bill.
  v_period := case v_bill.frequency
                when 'weekly' then 7
                when 'quarterly' then 92
                when 'yearly' then 366
                else 31 end;
  v_start := case when p_auto then p_expense_date else coalesce(p_expected_due, p_expense_date) end;
  if v_start >= p_next_due then
    v_start := p_expense_date;
  end if;
  v_end := p_next_due;
  if not p_auto then
    if p_next_due > greatest(v_start, p_expense_date) + v_period + 7 then
      raise exception 'cycle_bad_next';
    end if;
    v_end := least(p_next_due, v_start + v_period);
  end if;

  -- This exact engine cycle already exists (a retry, or the date written
  -- back): only move the schedule on, quietly. The same due date under a
  -- different frequency is a clash like any other, judged below.
  if p_auto and exists (
    select 1 from public.expenses e
     where e.bill_id = p_bill_id and e.auto_cycle
       and e.cycle_due = p_expense_date and e.cycle_next = p_next_due
  ) then
    update public.recurring_bills set next_due_date = p_next_due where id = p_bill_id;
    return jsonb_build_object('status', 'exists', 'next_due_date', p_next_due);
  end if;

  -- Re-billing a period that already went out, engine or manual, whatever
  -- frequency it was made under (the due date or the frequency was changed
  -- by hand). Two kinds of clash:
  --  * the new cycle is mostly that period: the engine skips it whole and
  --    moves on to the next date;
  --  * most of the new cycle is unbilled, but it would bill three quarters
  --    or more of that period again (a quarter or a year starting inside a
  --    billed month, a month starting the day after a weekly cycle): the
  --    engine starts it when that period runs out instead, so nothing is
  --    billed twice and the unbilled months aren't lost. Never later than
  --    the date it would have moved on to anyway.
  -- Small overlaps, like moving the rent day a few days, still bill normally.
  select e.cycle_due,
         e.cycle_next,
         (least(e.cycle_next, v_end) - greatest(e.cycle_due, v_start)) * 2 > (v_end - v_start)
    into v_clash, v_clash_next, v_clash_most
    from public.expenses e
   where e.bill_id = p_bill_id
     and e.cycle_due is not null
     and e.cycle_due < v_end
     and v_start < e.cycle_next
     and (
       (least(e.cycle_next, v_end) - greatest(e.cycle_due, v_start)) * 2 > (v_end - v_start)
       or (least(e.cycle_next, v_end) - greatest(e.cycle_due, v_start)) * 4 >= (e.cycle_next - e.cycle_due) * 3
     )
   order by (least(e.cycle_next, v_end) - greatest(e.cycle_due, v_start)) * 2 > (v_end - v_start) desc,
            e.cycle_next desc
   limit 1;
  if v_clash is not null then
    if p_auto then
      v_roll := case when v_clash_most then p_next_due else least(v_clash_next, p_next_due) end;
      update public.recurring_bills set next_due_date = v_roll where id = p_bill_id;
      return jsonb_build_object('status', 'too_soon', 'clash', v_clash, 'next_due_date', v_roll);
    end if;
    -- A manual request never moves the schedule on its own: the payer fixes
    -- the date and asks again.
    raise exception 'cycle_period_already_billed';
  end if;

  if v_payer is null or not exists (
    select 1 from public.house_members
     where house_id = v_bill.house_id and user_id = v_payer
  ) then
    raise exception 'cycle_payer_not_member';
  end if;

  for r in select value from jsonb_array_elements(p_rows) loop
    if (r->>'user_id') is null or (r->>'amount_owed') is null then
      raise exception 'cycle_bad_row';
    end if;
    if (r->>'amount_owed')::numeric < 0 then
      raise exception 'cycle_negative_share';
    end if;
    if not exists (
      select 1 from public.house_members
       where house_id = v_bill.house_id and user_id = (r->>'user_id')::uuid
    ) then
      raise exception 'cycle_share_not_member';
    end if;
    v_total := v_total + round((r->>'amount_owed')::numeric, 2);
  end loop;

  select count(distinct value->>'user_id') into v_rows from jsonb_array_elements(p_rows);
  if v_rows <> jsonb_array_length(p_rows) then
    raise exception 'cycle_duplicate_share';
  end if;
  if v_total <> round(v_bill.amount, 2) then
    raise exception 'cycle_shares_dont_add_up';
  end if;

  -- Lets the insert guard trigger through, for this transaction only.
  perform set_config('housesync.bill_cycle', 'on', true);

  insert into public.expenses (
    house_id, title, amount, category, paid_by, split_type, "date",
    notes, created_by, bill_id, auto_cycle, cycle_due, cycle_next, cycle_frequency,
    nudge_after_days
  ) values (
    v_bill.house_id, v_bill.title, v_bill.amount, v_bill.category, v_payer,
    p_split_type, p_expense_date, p_notes, v_creator, p_bill_id,
    coalesce(p_auto, false), v_start, v_end, v_bill.frequency,
    p_nudge_after_days
  )
  returning id into v_expense_id;

  perform set_config('housesync.bill_cycle', '', true);

  -- The payer's own share is settled the moment it exists, as everywhere else.
  insert into public.expense_splits (expense_id, user_id, amount_owed, status, paid_at, confirmed_at)
  select v_expense_id,
         (value->>'user_id')::uuid,
         round((value->>'amount_owed')::numeric, 2),
         case when (value->>'user_id')::uuid = v_payer then 'confirmed' else 'unpaid' end,
         case when (value->>'user_id')::uuid = v_payer then v_now end,
         case when (value->>'user_id')::uuid = v_payer then v_now end
    from jsonb_array_elements(p_rows);

  update public.recurring_bills set next_due_date = p_next_due where id = p_bill_id;

  return jsonb_build_object(
    'status', 'created',
    'expense_id', v_expense_id,
    'next_due_date', p_next_due
  );
end;
$$;

revoke all on function public.create_bill_cycle(uuid, date, uuid, jsonb, date, date, jsonb, boolean, text, int, text, uuid) from public;
revoke all on function public.create_bill_cycle(uuid, date, uuid, jsonb, date, date, jsonb, boolean, text, int, text, uuid) from anon;
grant execute on function public.create_bill_cycle(uuid, date, uuid, jsonb, date, date, jsonb, boolean, text, int, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_bill_portions: only an explicit empty array clears
-- ---------------------------------------------------------------------------
create or replace function public.set_bill_portions(
  p_bill_id uuid,
  p_share_type text,
  p_rows jsonb,
  p_expected_due date default null,
  p_roll_to date default null
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_bill public.recurring_bills;
  v_total numeric := 0;
  v_target numeric;
  v_rows int;
  v_rolled boolean := false;
  r jsonb;
begin
  -- Anything that isn't a JSON array is a caller bug, never "clear them all".
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'portions_rows_not_array';
  end if;

  select * into v_bill from public.recurring_bills where id = p_bill_id for update;
  if not found then
    raise exception 'portions_no_bill';
  end if;
  if auth.uid() is null or v_bill.paid_by is distinct from auth.uid() then
    raise exception 'portions_payer_only'
      using hint = 'Only the person who pays this bill can give out its portions.';
  end if;

  if jsonb_array_length(p_rows) = 0 then
    delete from public.bill_splits where bill_id = p_bill_id;
    get diagnostics v_rows = row_count;
    return jsonb_build_object('status', 'cleared', 'removed', v_rows);
  end if;

  if p_share_type not in ('amount', 'percent') then
    raise exception 'portions_bad_type';
  end if;
  v_target := case when p_share_type = 'percent' then 100 else round(v_bill.amount, 2) end;

  for r in select value from jsonb_array_elements(p_rows) loop
    if (r->>'user_id') is null or (r->>'value') is null then
      raise exception 'portions_bad_row';
    end if;
    if (r->>'value')::numeric < 0 then
      raise exception 'portions_negative';
    end if;
    if not exists (
      select 1 from public.house_members
       where house_id = v_bill.house_id and user_id = (r->>'user_id')::uuid
    ) then
      raise exception 'portions_not_member';
    end if;
    v_total := v_total + round((r->>'value')::numeric, 2);
  end loop;

  select count(distinct value->>'user_id') into v_rows from jsonb_array_elements(p_rows);
  if v_rows <> jsonb_array_length(p_rows) then
    raise exception 'portions_duplicate';
  end if;
  if v_total <> v_target then
    raise exception 'portions_dont_add_up';
  end if;

  delete from public.bill_splits where bill_id = p_bill_id;
  insert into public.bill_splits (bill_id, user_id, share_type, value)
  select p_bill_id, (value->>'user_id')::uuid, p_share_type, round((value->>'value')::numeric, 2)
    from jsonb_array_elements(p_rows);

  if p_roll_to is not null and v_bill.next_due_date is not distinct from p_expected_due then
    update public.recurring_bills set next_due_date = p_roll_to where id = p_bill_id;
    v_rolled := true;
  end if;

  return jsonb_build_object(
    'status', 'saved',
    'rolled', v_rolled,
    'next_due_date', case when v_rolled then p_roll_to else v_bill.next_due_date end
  );
end;
$$;

revoke all on function public.set_bill_portions(uuid, text, jsonb, date, date) from public;
revoke all on function public.set_bill_portions(uuid, text, jsonb, date, date) from anon;
grant execute on function public.set_bill_portions(uuid, text, jsonb, date, date) to authenticated;
