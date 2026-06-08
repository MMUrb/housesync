-- ============================================================================
-- Track whether a new user has been sent their one-time welcome email, so it
-- only ever goes out once. Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.profiles add column if not exists welcomed_at timestamptz;
