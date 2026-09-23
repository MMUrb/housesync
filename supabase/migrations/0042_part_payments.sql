-- Part payments on itemised expenses.
--
-- A split used to be all-or-nothing: one row per (expense, user), whose status
-- walked unpaid -> paid -> confirmed as a whole. Paying part of what you owe
-- someone needs a row to carry the claimed part while the remainder stays
-- owed, so a (expense, user) pair may now hold SEVERAL rows. Every reader
-- sums rows rather than assuming one per person, so balances are unchanged;
-- the two writers that relied on uniqueness move into atomic functions below.
--
-- Both functions take the same per-house advisory lock as settle_sweep and
-- the settle-mode guard (0039), so a payment, an expense edit, a sweep and a
-- mode switch always serialise instead of interleaving mid-transaction.

-- 1. Drop the one-row-per-person constraint; keep a plain index for the joins.
--    Dropped by type rather than by name, in case production named it
--    differently from a fresh schema.sql install.
do $$
declare
  v_con text;
begin
  for v_con in
    select conname from pg_constraint
     where conrelid = 'public.expense_splits'::regclass and contype = 'u'
  loop
    execute format('alter table public.expense_splits drop constraint %I', v_con);
  end loop;
end;
$$;

create index if not exists expense_splits_expense_user_idx
  on public.expense_splits (expense_id, user_id);

-- 2. Pay some or all of what you owe one housemate, in one transaction.
--
-- Allocates the amount across the caller's unpaid splits on p_to_user's
-- expenses, oldest expense first: full splits flip to 'paid' (the existing
-- claim flow), and the boundary split is divided in two, the covered part
-- claimed on a fresh row and the remainder left owed. Locks the rows first so
-- two devices paying at once serialise instead of double-claiming.
--
-- SECURITY INVOKER: row-level security still applies, so the function can only
-- touch splits in houses the caller belongs to.
create or replace function public.pay_itemised(
  p_house_id uuid,
  p_to_user uuid,
  p_amount numeric
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  v_pay numeric := round(coalesce(p_amount, 0), 2);
  v_ids uuid[] := '{}';
  v_amts numeric[] := '{}';
  v_total numeric := 0;
  v_left numeric;
  v_claimed uuid[] := '{}';
  v_new uuid;
  v_now timestamptz := now();
  i int;
  r record;
begin
  if v_me is null then
    raise exception 'pay_not_signed_in';
  end if;
  if p_to_user is null or p_to_user = v_me then
    raise exception 'pay_bad_recipient';
  end if;
  if v_pay <= 0 then
    raise exception 'pay_bad_amount';
  end if;

  -- Serialise against expense edits, settle_sweep and mode switches.
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || p_house_id::text));

  for r in
    select s.id, s.amount_owed
      from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
     where s.user_id = v_me
       and s.status = 'unpaid'
       and s.amount_owed > 0
       and e.house_id = p_house_id
       and e.paid_by = p_to_user
     order by e.date, e.created_at, s.id
       for update of s
  loop
    v_ids := v_ids || r.id;
    v_amts := v_amts || r.amount_owed;
    v_total := v_total + r.amount_owed;
  end loop;

  -- Half a penny of slack so 'pay everything' typed by hand never bounces.
  if v_pay > v_total + 0.005 then
    raise exception 'pay_more_than_owed';
  end if;

  v_left := v_pay;
  for i in 1 .. coalesce(array_length(v_ids, 1), 0) loop
    exit when v_left <= 0.004;
    if v_left >= v_amts[i] - 0.004 then
      -- Fully covered: the whole split becomes a pending claim, as today.
      update public.expense_splits
         set status = 'paid', paid_at = v_now
       where id = v_ids[i];
      v_claimed := v_claimed || v_ids[i];
      v_left := round(v_left - v_amts[i], 2);
    else
      -- Boundary: the remainder stays owed on this row, the covered part is
      -- claimed on its own row so the other side confirms exactly what was
      -- sent. Sums are preserved, so every balance stays correct throughout.
      update public.expense_splits
         set amount_owed = round(v_amts[i] - v_left, 2)
       where id = v_ids[i];
      insert into public.expense_splits (expense_id, user_id, amount_owed, status, paid_at)
      select expense_id, user_id, v_left, 'paid', v_now
        from public.expense_splits
       where id = v_ids[i]
      returning id into v_new;
      v_claimed := v_claimed || v_new;
      v_left := 0;
    end if;
  end loop;

  return jsonb_build_object('claimed_ids', to_jsonb(v_claimed), 'paid', v_pay);
end;
$$;

revoke all on function public.pay_itemised(uuid, uuid, numeric) from public;
grant execute on function public.pay_itemised(uuid, uuid, numeric) to authenticated;

-- 3. Replace an expense's splits atomically when it is edited.
--
-- The edit screen used to upsert on (expense_id, user_id), which needs the
-- unique constraint dropped above; and a delete-then-insert pair could strand
-- the expense with zero splits if the insert failed. One function, one
-- transaction, no half-states. RLS applies to both statements.
create or replace function public.rewrite_expense_splits(
  p_expense_id uuid,
  p_rows jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_house_id uuid;
begin
  if p_rows is null or jsonb_array_length(p_rows) = 0 then
    raise exception 'splits_rewrite_empty';
  end if;

  -- RLS-visible only to members of the expense's house.
  select house_id into v_house_id from public.expenses where id = p_expense_id;
  if v_house_id is null then
    raise exception 'splits_rewrite_no_expense';
  end if;

  -- Serialise against pay_itemised, settle_sweep and mode switches, so a
  -- concurrent part payment can't slip a fresh claim row past the delete.
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || v_house_id::text));

  delete from public.expense_splits where expense_id = p_expense_id;

  insert into public.expense_splits (expense_id, user_id, amount_owed, status, paid_at, confirmed_at)
  select p_expense_id,
         (r->>'user_id')::uuid,
         round((r->>'amount_owed')::numeric, 2),
         coalesce(r->>'status', 'unpaid'),
         (r->>'paid_at')::timestamptz,
         (r->>'confirmed_at')::timestamptz
    from jsonb_array_elements(p_rows) as r;

  if not exists (select 1 from public.expense_splits where expense_id = p_expense_id) then
    raise exception 'splits_rewrite_empty';
  end if;
end;
$$;

revoke all on function public.rewrite_expense_splits(uuid, jsonb) from public;
grant execute on function public.rewrite_expense_splits(uuid, jsonb) to authenticated;
