-- Remove phone capture and SMS reminders for good.
--
-- SMS was never shipped: the UI has been hidden behind FEATURES.phoneSms since
-- 2026-06-16 and is now deleted outright, along with PhoneVerification, the
-- /api/phone/* routes and lib/sms.ts. Nothing reads these columns any more.
--
-- DESTRUCTIVE: this drops stored phone numbers. Run it only AFTER the code
-- removal is deployed, so no live build is still selecting these columns.

drop table if exists public.phone_verifications;

alter table public.account_settings
  drop column if exists phone,
  drop column if exists phone_verified,
  drop column if exists notify_sms;
