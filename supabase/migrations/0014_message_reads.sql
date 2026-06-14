-- ============================================================================
-- Per-user chat read state, so the Chat tab can show an unread red dot and the
-- read position SYNCS across devices/platforms for the same account (read on
-- web -> dot clears on the native app too). One row per (user, house).
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create table if not exists public.message_reads (
  user_id      uuid not null references auth.users (id) on delete cascade,
  house_id     uuid not null references public.houses (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, house_id)
);

alter table public.message_reads enable row level security;

-- A user can only see and write their OWN read state.
drop policy if exists "message_reads_select" on public.message_reads;
create policy "message_reads_select" on public.message_reads for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "message_reads_insert" on public.message_reads;
create policy "message_reads_insert" on public.message_reads for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "message_reads_update" on public.message_reads;
create policy "message_reads_update" on public.message_reads for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
