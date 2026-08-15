-- 0039: Simplified settle up, hardening.
--
-- 1. settle_sweep(house): the square-house reconciliation as ONE transaction.
--    The first cut did it as two client requests (confirm splits, then absorb
--    settlements); an interruption between them flipped every balance's sign
--    with no way back. Here the nets are recomputed inside the function, and
--    both updates happen together or not at all. Returns true only for the
--    caller that actually swept, so exactly one "house is settled" chat note.
--
-- 2. Guards enforced in the database, not just in the settings UI:
--    - settle_mode may only be changed by the house owner;
--    - to 'simplified' only when no itemised "paid" claims are mid-confirm;
--    - to 'itemised' only when no unabsorbed settlements exist;
--    - a settlement may only be inserted while the house is 'simplified'.
--    A per-house transaction advisory lock serialises a mode switch against a
--    concurrent payment, so neither can slip past the other's check.

-- ---------------------------------------------------------------------------
-- Atomic sweep
-- ---------------------------------------------------------------------------
create or replace function public.settle_sweep(p_house_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_split_ids uuid[];
  v_sett_ids  uuid[];
  v_pending   int;
  v_off       int;
begin
  -- Serialise against concurrent sweeps, mode switches and payments.
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || p_house_id::text));

  -- Caller must be able to see the house (RLS), else nothing to do.
  if not exists (select 1 from public.houses where id = p_house_id) then
    return false;
  end if;

  -- Pin down exactly which rows this sweep is about BEFORE checking them.
  -- Each statement below sees its own snapshot (read committed), so without
  -- this an expense added between the check and the update could be swept
  -- up and wrongly confirmed. Rows created after this point are left alone.
  select coalesce(array_agg(s.id), '{}') into v_split_ids
    from public.expense_splits s
    join public.expenses e on e.id = s.expense_id
   where e.house_id = p_house_id and s.status <> 'confirmed';

  select coalesce(array_agg(id), '{}') into v_sett_ids
    from public.settlements
   where house_id = p_house_id and not absorbed;

  if cardinality(v_split_ids) = 0 and cardinality(v_sett_ids) = 0 then
    return false; -- nothing to reconcile
  end if;

  -- A payment still waiting on a confirm blocks the sweep.
  select count(*) into v_pending
    from public.settlements
   where id = any(v_sett_ids) and status = 'pending';
  if v_pending > 0 then return false; end if;

  -- Net position per person in pence must be exactly zero for everyone,
  -- computed over the pinned rows only.
  with legs as (
    select e.paid_by as uid, round(s.amount_owed * 100)::bigint as c
      from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
     where s.id = any(v_split_ids) and s.user_id <> e.paid_by
    union all
    select s.user_id, -round(s.amount_owed * 100)::bigint
      from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
     where s.id = any(v_split_ids) and s.user_id <> e.paid_by
    union all
    select from_user, round(amount * 100)::bigint
      from public.settlements
     where id = any(v_sett_ids)
    union all
    select to_user, -round(amount * 100)::bigint
      from public.settlements
     where id = any(v_sett_ids)
  ), nets as (
    select uid, sum(c) as net from legs group by uid
  )
  select count(*) into v_off from nets where net <> 0;
  if v_off > 0 then return false; end if;

  update public.expense_splits
     set status = 'confirmed', confirmed_at = now()
   where id = any(v_split_ids) and status <> 'confirmed';

  update public.settlements
     set absorbed = true
   where id = any(v_sett_ids) and not absorbed;

  return true;
end;
$$;

revoke all on function public.settle_sweep(uuid) from public;
grant execute on function public.settle_sweep(uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Guard: settle_mode changes
-- ---------------------------------------------------------------------------
create or replace function public.guard_settle_mode()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.settle_mode is not distinct from old.settle_mode then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || new.id::text));

  -- Owner only (auth.uid() is null for the service role, which is allowed).
  if auth.uid() is not null and auth.uid() is distinct from old.created_by then
    raise exception 'settle_mode_owner_only'
      using hint = 'Only the house owner can change how the house settles up.';
  end if;

  if new.settle_mode = 'simplified' and exists (
    select 1 from public.expense_splits s
      join public.expenses e on e.id = s.expense_id
     where e.house_id = new.id and s.status = 'paid'
  ) then
    raise exception 'settle_mode_pending_claims'
      using hint = 'Confirm or undo the payment marks waiting on Housemates first.';
  end if;

  if new.settle_mode = 'itemised' and exists (
    select 1 from public.settlements
     where house_id = new.id and not absorbed
  ) then
    raise exception 'settle_mode_open_settlements'
      using hint = 'Finish settling up first, then the house can switch back.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_settle_mode on public.houses;
create trigger trg_guard_settle_mode
  before update on public.houses
  for each row execute function public.guard_settle_mode();

-- ---------------------------------------------------------------------------
-- Guard: settlements only exist in simplified mode
-- ---------------------------------------------------------------------------
create or replace function public.guard_settlement_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_mode text;
begin
  perform pg_advisory_xact_lock(hashtext('housesync-settle:' || new.house_id::text));
  select settle_mode into v_mode from public.houses where id = new.house_id;
  if v_mode is distinct from 'simplified' then
    raise exception 'settlement_requires_simplified'
      using hint = 'This house is not using simplified settle up any more. Refresh and try again.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_settlement_insert on public.settlements;
create trigger trg_guard_settlement_insert
  before insert on public.settlements
  for each row execute function public.guard_settlement_insert();

-- Realtime: other housemates' screens refresh when a settlement changes,
-- the same way they do for expense_splits.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'settlements'
  ) then
    alter publication supabase_realtime add table public.settlements;
  end if;
end $$;
