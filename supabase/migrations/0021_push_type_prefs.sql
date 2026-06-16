-- ============================================================================
-- Per-type push notification preferences. Each user can opt out of specific
-- kinds of push (chat messages, new expenses, bill requests, payments to them)
-- while keeping the others. All default true, so existing users keep getting
-- everything until they turn a type off. Read server-side (admin client) when
-- fanning a notification out. Run once in the Supabase SQL Editor; safe to re-run.
-- ============================================================================

alter table public.account_settings
  add column if not exists notify_push_message boolean not null default true,
  add column if not exists notify_push_expense boolean not null default true,
  add column if not exists notify_push_bill    boolean not null default true,
  add column if not exists notify_push_paid    boolean not null default true;
