-- ============================================================================
-- Payment handles: let housemates pay each other back DIRECTLY (person-to-person).
-- HouseSync never holds or touches the money. Stored on profiles so that your
-- housemates (and only them) can see them via the existing profiles_select
-- policy, and only you can edit yours (profiles_update). All optional.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.profiles add column if not exists pay_monzo   text;
alter table public.profiles add column if not exists pay_paypal  text;
alter table public.profiles add column if not exists pay_revolut text;
alter table public.profiles add column if not exists pay_bank    text;
