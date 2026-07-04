-- ============================================================================
-- Drop the vestigial payment-handle columns on profiles. They were moved into
-- the payment_details table (with a share-with-house consent switch) back in
-- migration 0012, which also cleared their values. Nothing references them any
-- more (the app reads payment_details), so remove them to match the
-- consolidated schema.sql. Safe + idempotent.
-- ============================================================================

alter table public.profiles
  drop column if exists pay_monzo,
  drop column if exists pay_paypal,
  drop column if exists pay_revolut,
  drop column if exists pay_bank;
