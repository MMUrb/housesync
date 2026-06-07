-- ============================================================================
-- House chat: one shared message channel per house.
-- Run this once in the Supabase SQL Editor (Dashboard -> SQL Editor -> New
-- query -> paste -> Run). Safe to re-run.
-- ============================================================================

create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  house_id   uuid not null references public.houses (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_house_created
  on public.messages (house_id, created_at);

alter table public.messages enable row level security;

-- Only house members can read their house's messages.
drop policy if exists "messages_select" on public.messages;
create policy "messages_select" on public.messages for select to authenticated
  using (house_id in (select public.user_house_ids()));

-- Members can post, but only as themselves.
drop policy if exists "messages_insert" on public.messages;
create policy "messages_insert" on public.messages for insert to authenticated
  with check (house_id in (select public.user_house_ids()) and user_id = auth.uid());

-- You can delete your own messages.
drop policy if exists "messages_delete" on public.messages;
create policy "messages_delete" on public.messages for delete to authenticated
  using (user_id = auth.uid());

-- Enable Supabase Realtime so new messages stream live (idempotent).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
