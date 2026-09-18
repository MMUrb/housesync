-- Record when each person last actually opened the app.
--
-- auth.last_sign_in_at could never answer this: Supabase only moves it on a
-- fresh authentication, and our sessions persist and refresh silently, so a
-- user who opens the app every day kept the timestamp from the day they signed
-- up. The admin directory therefore read as "nobody has ever come back".
--
-- The LastSeenBeacon writes this column (at most once an hour per device)
-- whenever a signed-in person loads the app. Users may only write their own
-- row: the existing profiles_update policy already enforces that.
--
-- Additive and safe to run any time, before or after the deploy.

alter table public.profiles
  add column if not exists last_active_at timestamptz;

-- Backfill from the best evidence that already exists, so the column is useful
-- on day one rather than empty. Ongoing accuracy comes from the beacon.
update public.profiles p
set last_active_at = greatest(
  coalesce((select max(created_at) from public.activity      where user_id = p.id), 'epoch'::timestamptz),
  coalesce((select max(created_at) from public.messages      where user_id = p.id), 'epoch'::timestamptz),
  coalesce((select max(last_read_at) from public.message_reads where user_id = p.id), 'epoch'::timestamptz),
  coalesce((select max(created_at) from public.expenses      where created_by = p.id), 'epoch'::timestamptz),
  coalesce((select max(completed_at) from public.chores      where completed_by = p.id), 'epoch'::timestamptz)
)
where last_active_at is null
  and greatest(
    coalesce((select max(created_at) from public.activity      where user_id = p.id), 'epoch'::timestamptz),
    coalesce((select max(created_at) from public.messages      where user_id = p.id), 'epoch'::timestamptz),
    coalesce((select max(last_read_at) from public.message_reads where user_id = p.id), 'epoch'::timestamptz),
    coalesce((select max(created_at) from public.expenses      where created_by = p.id), 'epoch'::timestamptz),
    coalesce((select max(completed_at) from public.chores      where completed_by = p.id), 'epoch'::timestamptz)
  ) > 'epoch'::timestamptz;
