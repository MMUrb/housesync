-- ============================================================================
-- Records each time someone enters the correct access code to get past the
-- waitlist gate. Anonymous (pre-signup) — we keep when / rough location /
-- device only, never a raw IP. Run once in the Supabase SQL Editor.
--
-- RLS enabled with NO policies → only the service-role key (API + admin) can
-- read or write it.
-- ============================================================================

create table if not exists public.waitlist_unlocks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  country text,
  city text,
  user_agent text,
  visitor_hash text
);

alter table public.waitlist_unlocks enable row level security;

create index if not exists idx_waitlist_unlocks_created on public.waitlist_unlocks (created_at desc);
