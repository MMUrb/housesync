-- ============================================================================
-- Remove the raw bank-transfer option from payment details. Housemates now pay
-- each other only via payment LINKS (Monzo / PayPal / Revolut), which don't
-- expose an account number. Dropping the free-text bank field (name / sort code
-- / account number) minimises the sensitive financial data HouseSync stores.
-- The app no longer reads or writes this column. Safe + idempotent.
-- ============================================================================

alter table public.payment_details drop column if exists bank;
