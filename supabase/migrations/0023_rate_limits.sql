-- ============================================================================
-- Lightweight, Postgres-backed rate limiting for public / expensive endpoints
-- (waitlist sign-ups, verification emails, error + analytics ingestion).
-- Serverless functions are stateless, so the counters live in the DB. Fixed
-- window: each key gets at most `p_max` hits per `p_window_seconds`. The table
-- is keyed by identifier (e.g. "waitlist:<ip>"), so it's bounded by distinct
-- callers, not total traffic. RLS on with NO policies => only the service-role
-- client (server) can read/write it. Run once in the SQL Editor; safe to re-run.
-- ============================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;

-- Atomically record a hit and report whether it's allowed. Returns true when the
-- caller is under the limit, false once they've exceeded it for the window.
create or replace function public.rate_limit_hit(
  p_key text,
  p_max integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  select count, window_start into v_count, v_start
  from public.rate_limits
  where key = p_key
  for update;

  if not found then
    insert into public.rate_limits (key, count, window_start)
    values (p_key, 1, now())
    on conflict (key) do update set count = public.rate_limits.count + 1;
    return true;
  end if;

  -- Window elapsed: start a fresh one.
  if v_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;

  if v_count >= p_max then
    return false;
  end if;

  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end;
$$;
