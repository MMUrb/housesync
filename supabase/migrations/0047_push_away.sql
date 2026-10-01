-- ============================================================================
-- "While you're away" push preference. The daily reminders job sends a
-- catch-up push to someone in a house who hasn't opened HouseSync for 7 days,
-- and once more at 21 days, then stops until they come back. Defaults true
-- like the other push types, so it can be turned off in Settings >
-- Notifications. Read server-side (admin client) when the job sends.
-- Run once in the Supabase SQL Editor; safe to re-run.
-- ============================================================================

alter table public.account_settings
  add column if not exists notify_push_away boolean not null default true;
