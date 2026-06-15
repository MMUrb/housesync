-- ============================================================================
-- Production error log. Server crashes (via instrumentation.onRequestError),
-- unexpected client errors, and notable caught failures (e.g. a 500 from the
-- signup flow) land here so they show in the admin dashboard and trigger an
-- email alert. Service-role only — RLS on with NO policies, like
-- waitlist_unlocks. Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  source      text not null default 'server',  -- 'server' | 'client'
  message     text not null,
  stack       text,
  url         text,                             -- request path / page url
  user_id     uuid,                             -- if known
  user_agent  text,
  digest      text,                             -- fingerprint for grouping
  resolved_at timestamptz
);

alter table public.error_logs enable row level security;

create index if not exists idx_error_logs_created on public.error_logs (created_at desc);
create index if not exists idx_error_logs_unresolved
  on public.error_logs (created_at desc) where resolved_at is null;
