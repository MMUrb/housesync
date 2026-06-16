-- ============================================================================
-- More anonymous churn context: how much the person actually used HouseSync
-- before deleting (houses joined, messages sent, expenses added). Captured at
-- deletion time because the underlying rows are erased with the account. These
-- are plain counts, not identity. Run once in the Supabase SQL Editor.
-- ============================================================================

alter table public.deletion_feedback
  add column if not exists houses_joined  int,
  add column if not exists messages_sent  int,
  add column if not exists expenses_added int;
