-- ============================================================================
-- Add `notices` to the supabase_realtime publication.
--
-- The app's single house Realtime channel subscribes to postgres_changes for
-- every house table INCLUDING notices (for the live noticeboard). Supabase
-- errors the ENTIRE channel subscription ("system: error") if any ONE bound
-- table is missing from the publication — which silently killed live delivery
-- for the whole channel: chat messages, expenses, bills, chores, everything.
-- `notices` was bound (0026-era noticeboard) but never published (0024 only
-- covered the older tables), so add it here. Run once in the Supabase SQL
-- Editor; safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notices'
  ) then
    alter publication supabase_realtime add table public.notices;
  end if;
end $$;
