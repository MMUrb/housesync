-- ============================================================================
-- Add anonymous, non-identifying context to deletion feedback so the churn
-- report is more useful: how long the person was a member before leaving, and
-- which platform they left from. Both are aggregate signals, not identity.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.deletion_feedback
  add column if not exists days_active int,   -- account age in days at deletion
  add column if not exists platform   text;   -- 'web' | 'app'
