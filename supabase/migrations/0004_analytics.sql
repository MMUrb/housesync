-- ============================================================================
-- First-party, cookieless page-view analytics.
-- Run once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query ->
-- paste -> Run). Safe to re-run.
--
-- Only the service-role key (the /admin dashboard + /api/track endpoint, both
-- server-only) can read or write this table. RLS is enabled with NO policies,
-- so anon/authenticated clients are denied entirely.
-- ============================================================================

create table if not exists public.page_views (
  id           bigint generated always as identity primary key,
  path         text not null,
  referrer     text,
  visitor_hash text,
  country      text,
  created_at   timestamptz not null default now()
);

create index if not exists idx_page_views_created on public.page_views (created_at desc);

alter table public.page_views enable row level security;
-- (Intentionally no policies: service-role bypasses RLS; everyone else is denied.)
