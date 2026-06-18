-- ============================================================================
-- Live sync for shared house data. Adds the house tables to the
-- supabase_realtime publication so a change by one housemate — a new expense,
-- a bill, a chore, a settle-up, someone joining — streams to everyone within a
-- second, with no manual reload (messages was already added in 0001). The app
-- subscribes per active house and does a soft refresh on any change; RLS still
-- gates exactly what each user is allowed to receive. Run once in the Supabase
-- SQL Editor; safe to re-run.
-- ============================================================================

do $$
declare
  t text;
begin
  foreach t in array array[
    'expenses', 'expense_splits', 'recurring_bills', 'chores', 'activity', 'house_members'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
