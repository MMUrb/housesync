-- 0049: housemates can no longer read each other's email (audit M9).
--
-- RUN THIS ONLY AFTER the app deploy that goes with 0048 is live. Until that
-- deploy the app read profiles with select *, which this refuses (every name
-- and avatar in the app would go blank).
--
-- Signed-in users get every profiles column except email, granted by name.
-- The server's admin client (reminder emails, the admin pages) is unaffected.
-- NOTE for later migrations: a new profiles column must also be granted
-- (grant select (col) on public.profiles to authenticated), or the app can't
-- read it.

do $$
declare
  v_cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into v_cols
    from information_schema.columns
   where table_schema = 'public'
     and table_name = 'profiles'
     and column_name <> 'email';

  execute 'revoke select on table public.profiles from anon, authenticated';
  execute format('grant select (%s) on table public.profiles to authenticated', v_cols);
end $$;

-- Check: one row back, each column named after the value it should show.
select
  has_column_privilege('authenticated', 'public.profiles', 'email', 'select') as housemates_see_email_false,
  has_column_privilege('authenticated', 'public.profiles', 'name', 'select')  as names_still_readable_true;
