-- ============================================================================
-- Opt-in email verification, separate from Supabase's auto-confirmation (which
-- is off). email_verified_at = the user actually proved they own their email:
-- either by clicking our verify link, or by signing in via OAuth / confirming
-- an email change (both handled in /auth/callback).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

alter table public.account_settings add column if not exists email_verified_at timestamptz;
alter table public.account_settings add column if not exists email_verify_token text;
alter table public.account_settings add column if not exists email_verify_expires timestamptz;
