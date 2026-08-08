-- Written store reviews, synced nightly alongside store_daily by
-- /api/cron/store-sync (and the admin Sync now button).
--
-- iOS rows come from the App Store Connect customerReviews API; Android rows
-- from the reviews CSVs in the Play statistics bucket. Play's CSVs carry no
-- reviewer name, so author is null there. Service-role only: RLS on, no
-- policies. Additive and safe to run any time.

create table if not exists public.store_reviews (
  id          text primary key,  -- "ios-<asc id>" or "and-<millis>-<text hash>"
  platform    text not null check (platform in ('ios', 'android')),
  rating      int  not null check (rating between 1 and 5),
  title       text,
  body        text,
  author      text,
  territory   text,              -- iOS: territory code (GBR); Android: reviewer language (en_GB)
  app_version text,
  reviewed_at timestamptz not null,
  synced_at   timestamptz not null default now()
);

alter table public.store_reviews enable row level security;
-- Intentionally no policies: clients get nothing; only the service role reads.
