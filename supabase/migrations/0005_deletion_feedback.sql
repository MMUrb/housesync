-- ============================================================================
-- Anonymous account-deletion feedback ("why are you leaving?").
-- Run once in the Supabase SQL Editor. Safe to re-run.
--
-- Deliberately stores NO user id or email: a user who deletes their account has
-- exercised their right to erasure, so we keep only the anonymous reason +
-- optional comment. The row therefore is NOT cascade-linked to auth.users and
-- survives the account deletion. Service-role only (RLS enabled, no policies).
-- ============================================================================

create table if not exists public.deletion_feedback (
  id         bigint generated always as identity primary key,
  reason     text,
  comment    text,
  created_at timestamptz not null default now()
);

create index if not exists idx_deletion_feedback_created
  on public.deletion_feedback (created_at desc);

alter table public.deletion_feedback enable row level security;
-- (No policies on purpose: only the server's service-role key can read/write.)
