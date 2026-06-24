-- ============================================================================
-- Per-type email preferences (granular unsubscribe). Each user can opt out of
-- specific kinds of email while keeping the rest. All default true, so existing
-- users keep getting everything until they turn a type off. Read server-side
-- (the reminders cron) for the bill + payment ones; the marketing categories
-- are standing preferences honoured when those emails are sent. Account and
-- security emails (verification, password) are always sent and not listed here.
-- Run once in the Supabase SQL Editor; safe to re-run.
-- ============================================================================

alter table public.account_settings
  add column if not exists notify_email_bills   boolean not null default true,
  add column if not exists notify_email_nudges  boolean not null default true,
  add column if not exists notify_email_product boolean not null default true,
  add column if not exists notify_email_tips    boolean not null default true,
  add column if not exists notify_email_surveys boolean not null default true,
  add column if not exists notify_email_offers  boolean not null default true;
