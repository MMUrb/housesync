-- ============================================================================
-- 0051: one "News from HouseSync" email switch, and a log of admin emails.
--
-- Settings showed four marketing email switches (product updates, tips,
-- surveys, offers). Offers is gone (there is nothing to buy), and the other
-- three merge into a single News switch. Everyone keeps their current choice:
-- News starts off only for people who had switched off all three it replaces.
-- The old columns stay (unused) so nothing that reads them breaks.
--
-- email_broadcasts records each email sent from the admin Email tab. Service
-- role only: RLS on with no policies, like error_logs.
--
-- Additive and safe to run before or after the deploy. Safe to re-run.
-- ============================================================================

alter table public.account_settings
  add column if not exists notify_email_news boolean not null default true;

update public.account_settings
set notify_email_news = false
where notify_email_product = false
  and notify_email_tips = false
  and notify_email_surveys = false
  and notify_email_news = true;

create table if not exists public.email_broadcasts (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('news', 'service')),
  subject     text not null,
  body        text not null,
  recipients  int not null default 0,
  sent        int not null default 0,
  failed      int not null default 0,
  sent_by     uuid
);

alter table public.email_broadcasts enable row level security;

create index if not exists idx_email_broadcasts_created
  on public.email_broadcasts (created_at desc);
