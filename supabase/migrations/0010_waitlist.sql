-- ============================================================================
-- Pre-launch waitlist: emails captured by the public /waitlist gate.
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- RLS is ENABLED with NO policies, so the anon/auth keys can't read or write
-- this table — only the service-role key (used by the API route + admin
-- dashboard) can touch it. That keeps the email list private.
-- ============================================================================

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  source text,
  created_at timestamptz not null default now(),
  notified_at timestamptz
);

alter table public.waitlist enable row level security;

create index if not exists idx_waitlist_created on public.waitlist (created_at desc);
