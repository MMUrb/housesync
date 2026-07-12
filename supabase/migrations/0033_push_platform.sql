-- Route native push by platform: iOS device tokens go straight to APNs, Android
-- FCM tokens stay on FCM. Nullable; existing native rows (all Android today) stay
-- null and keep using FCM. Additive and safe to run any time.
alter table public.push_subscriptions
  add column if not exists platform text;
