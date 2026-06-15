-- ============================================================================
-- Push notification targets. One row per device/browser a user has opted in
-- on: web (browser/PWA via Web Push + VAPID) or native (the Android app via
-- FCM). The server reads these with the service role to fan out a push; users
-- only ever touch their own rows. Run once in the Supabase SQL Editor.
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null check (kind in ('web', 'native')),
  endpoint   text,   -- web: push endpoint URL
  p256dh     text,   -- web: client public key
  auth       text,   -- web: client auth secret
  token      text,   -- native: FCM registration token
  created_at timestamptz not null default now(),
  unique (user_id, endpoint),
  unique (user_id, token)
);

create index if not exists idx_push_subs_user on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists "push_subs_select" on public.push_subscriptions;
create policy "push_subs_select" on public.push_subscriptions for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "push_subs_insert" on public.push_subscriptions;
create policy "push_subs_insert" on public.push_subscriptions for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "push_subs_update" on public.push_subscriptions;
create policy "push_subs_update" on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "push_subs_delete" on public.push_subscriptions;
create policy "push_subs_delete" on public.push_subscriptions for delete to authenticated
  using (user_id = auth.uid());
