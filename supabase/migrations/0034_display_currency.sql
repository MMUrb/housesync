-- Personal display currency. When set, a user sees an approximate second amount
-- in this currency next to the house's real totals (dashboard balances, etc).
-- Null = off (show only the house currency). This is purely a per-user display
-- preference: it never changes what anyone actually owes, so no stored amounts
-- are converted.
alter table public.account_settings
  add column if not exists display_currency text;
