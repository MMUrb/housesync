-- 0044: atomic bill cycles, atomic portions, exact nudge days.
--
-- Review fixes for the bill-portions engine (0043):
-- 1. A cycle (expense + its splits + the next_due_date roll) is now created by
--    ONE function in ONE transaction, with the bill row locked and a
--    compare-and-swap on next_due_date. Overlapping cron runs, a stale edit
--    form writing an old due date back, a failed roll, or a timeout mid-bill
--    can no longer produce a second cycle for the same due date. A partial
--    unique index on the engine's own cycles is the last line of defence.
-- 2. Saving portions is one transaction (validated delete + insert), so a
--    failure can never leave a half-set or silently wipe the old set.
-- 3. Changing who pays a bill clears its portions: they were given out by the
--    previous payer, and nobody else may send money on their numbers.
-- 4. expenses.nudge_on (date + nudge_after_days) lets the daily nudge query
--    ask for exactly today's rows instead of scanning a 60-day window.
-- 5. anon can no longer EXECUTE the signed-in-only money functions
--    (Supabase grants EXECUTE to anon by default; revoking from PUBLIC is
--    not enough).
--
-- Additive only: run BEFORE deploying the code that calls these functions.
-- The live code keeps working in the meantime.

-- ---------------------------------------------------------------------------
-- Columns + indexes
-- ---------------------------------------------------------------------------
alter table public.expenses
  add column if not exists auto_cycle boolean not null default false;

-- One engine cycle per bill per due date, whatever happens upstream.
create unique index if not exists expenses_auto_cycle_once
  on public.expenses (bill_id, "date")
  where auto_cycle and bill_id is not null;

alter table public.expenses
  add column if not exists nudge_on date
  generated always as ("date" + nudge_after_days) stored;

create index if not exists idx_expenses_nudge_on
  on public.expenses (nudge_on)
  where nudge_on is not null;

-- ---------------------------------------------------------------------------
-- create_bill_cycle: expense + splits + roll, all or nothing
-- ---------------------------------------------------------------------------
-- Used by the daily cron (service role, p_auto = true: the engine's cycle for
-- the due date p_expense_date) and by the Request button (signed-in member,
-- p_auto = false). p_expected_due is the next_due_date the caller saw; if the
-- bill has moved on since, nothing is written and 'stale' comes back.
--
-- SECURITY INVOKER: for signed-in callers RLS applies to every statement, so
-- this can only touch bills in the caller's houses. The service role bypasses
-- RLS, so every input is validated here too: shares must be current members,
-- non-negative, one row each, and add up to exactly the bill amount.
create or replace function public.create_bill_cycle(
  p_bill_id uuid,
  p_expected_due date,
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
  v_now timestamptz := now();
  r jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
    raise exception 'cycle_no_rows';
  end if;
  if p_expense_date is null then
    raise exception 'cycle_no_date';
  end if;
  if p_split_type not in ('equal', 'custom') then
    raise exception 'cycle_bad_split_type';
  end if;
  if v_creator is null then
    raise exception 'cycle_no_actor';
  end if;

  -- Lock the bill: two callers for the same bill now queue here.
  select * into v_bill from public.recurring_bills where id = p_bill_id for update;
  if not found then
    return jsonb_build_object('status', 'missing');
  end if;

  -- Serialise against pay_itemised, rewrite_expense_splits, settle_sweep and
  -- settle-mode switches, like every other split writer.
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || v_bill.house_id::text));

  -- The bill moved on since the caller looked (another run, a housemate's
  -- tap, a stale edit form): write nothing.
  if v_bill.next_due_date is distinct from p_expected_due then
    return jsonb_build_object('status', 'stale', 'next_due_date', v_bill.next_due_date);
  end if;

  -- The engine already made this due date's cycle (for example the due date
  -- was written back by an old edit form): only move the schedule on.
  if p_auto and exists (
    select 1 from public.expenses
     where bill_id = p_bill_id and auto_cycle and "date" = p_expense_date
  ) then
    update public.recurring_bills set next_due_date = p_next_due where id = p_bill_id;
    return jsonb_build_object('status', 'exists', 'next_due_date', p_next_due);
  end if;

  v_payer := coalesce(v_bill.paid_by, v_bill.created_by);
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

  insert into public.expenses (
    house_id, title, amount, category, paid_by, split_type, "date",
    notes, created_by, bill_id, auto_cycle, nudge_after_days
  ) values (
    v_bill.house_id, v_bill.title, v_bill.amount, v_bill.category, v_payer,
    p_split_type, p_expense_date, p_notes, v_creator, p_bill_id,
    coalesce(p_auto, false), p_nudge_after_days
  )
  returning id into v_expense_id;

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

revoke all on function public.create_bill_cycle(uuid, date, date, date, jsonb, boolean, text, int, text, uuid) from public;
revoke all on function public.create_bill_cycle(uuid, date, date, date, jsonb, boolean, text, int, text, uuid) from anon;
grant execute on function public.create_bill_cycle(uuid, date, date, date, jsonb, boolean, text, int, text, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- set_bill_portions: validated, all-or-nothing save (empty rows = clear)
-- ---------------------------------------------------------------------------
-- p_roll_to: when saving portions on a bill that is already well overdue,
-- the editor moves next_due_date on in the same transaction (only if it is
-- still p_expected_due), so that overdue cycle is never sent by surprise.
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
  select * into v_bill from public.recurring_bills where id = p_bill_id for update;
  if not found then
    raise exception 'portions_no_bill';
  end if;
  if auth.uid() is null or coalesce(v_bill.paid_by, v_bill.created_by) is distinct from auth.uid() then
    raise exception 'portions_payer_only'
      using hint = 'Only the person who pays this bill can give out its portions.';
  end if;

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then
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

-- ---------------------------------------------------------------------------
-- A new payer starts from manual: the old payer's portions are cleared
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the clear happens even when the member making the edit
-- isn't the new payer (RLS would otherwise filter the delete to zero rows).
create or replace function public.clear_portions_on_payer_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.paid_by, new.created_by) is distinct from coalesce(old.paid_by, old.created_by) then
    delete from public.bill_splits where bill_id = new.id;
  end if;
  return null;
end;
$$;

revoke all on function public.clear_portions_on_payer_change() from public;
revoke all on function public.clear_portions_on_payer_change() from anon;
revoke all on function public.clear_portions_on_payer_change() from authenticated;

drop trigger if exists trg_clear_portions_on_payer_change on public.recurring_bills;
create trigger trg_clear_portions_on_payer_change
  after update of paid_by, created_by on public.recurring_bills
  for each row execute function public.clear_portions_on_payer_change();

-- ---------------------------------------------------------------------------
-- Signed-in-only money functions: take EXECUTE away from anon
-- ---------------------------------------------------------------------------
-- Guarded so a signature that differs in production can't abort the script.
do $$
declare
  v_fn text;
begin
  foreach v_fn in array array[
    'public.pay_itemised(uuid, uuid, numeric)',
    'public.rewrite_expense_splits(uuid, jsonb)',
    'public.settle_sweep(uuid)',
    'public.transfer_house_admin(uuid, uuid)'
  ] loop
    if to_regprocedure(v_fn) is not null then
      execute format('revoke execute on function %s from public, anon', v_fn);
    end if;
  end loop;
end;
$$;
