-- ============================================================================
-- FIX: signup failing with "Database error saving new user".
--
-- handle_new_user() picked an avatar colour with
--   palette[1 + (hash::bit(32)::int % len)]
-- The cast yields a SIGNED int, so ~half of user ids gave a negative value;
-- Postgres modulo keeps the sign, the index went <= 0, and out-of-range array
-- access returns NULL — which violated profiles.avatar_color NOT NULL and
-- aborted the whole auth insert.
--
-- Fix: widen to bigint before abs() (abs(INT_MIN) overflows) so the modulo is
-- always non-negative → index always in [1, len], plus a coalesce backstop.
-- Run once in the Supabase SQL Editor. Safe to re-run.
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  palette text[] := array['#6f53f5','#1bb27e','#f5953f','#e0567f','#3f9fe0','#9b5fe0','#e0b53f','#3fcdad'];
  v_idx int;
begin
  v_idx := 1 + (abs(('x' || substr(md5(new.id::text), 1, 8))::bit(32)::int::bigint) % array_length(palette, 1));
  insert into public.profiles (id, name, email, avatar_color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(palette[v_idx], '#6f53f5')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
