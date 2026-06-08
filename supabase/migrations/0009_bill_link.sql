-- ============================================================================
-- Link a logged bill payment back to its recurring bill, so the Bills hub can
-- show the current cycle's per-person paid/unpaid status.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.expenses
  add column if not exists bill_id uuid references public.recurring_bills (id) on delete set null;

create index if not exists idx_expenses_bill on public.expenses (bill_id);
