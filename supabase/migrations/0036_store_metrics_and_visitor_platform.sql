-- Store download metrics + richer (still anonymous) page-view tracking.
--
-- 1) store_daily: one row per day per platform, filled by the nightly
--    /api/cron/store-sync job from App Store Connect (sales reports) and the
--    Google Play statistics bucket. Service-role only: RLS on, no policies.
--
-- 2) page_views gains two coarse columns, derived server-side from the
--    user agent at insert time. The raw user agent is NOT stored, no IPs are
--    stored, and the daily-rotating visitor hash is unchanged, so this adds
--    no cross-day tracking. Purely "which platform / which browser".
--
-- Additive and safe to run any time, before or after the deploy.

create table if not exists public.store_daily (
  day        date not null,
  platform   text not null check (platform in ('ios', 'android')),
  downloads  int,
  updates    int,
  uninstalls int,
  synced_at  timestamptz not null default now(),
  primary key (day, platform)
);

alter table public.store_daily enable row level security;
-- Intentionally no policies: clients get nothing; only the service role reads.

alter table public.page_views
  add column if not exists platform text,
  add column if not exists browser  text;
