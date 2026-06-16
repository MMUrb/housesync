-- ============================================================================
-- Personal monthly spending budget. Stored per user on account_settings (their
-- own private setting). Null = no budget set. Run once in the Supabase SQL
-- Editor. Safe to re-run.
-- ============================================================================

alter table public.account_settings
  add column if not exists monthly_budget numeric(12, 2);
