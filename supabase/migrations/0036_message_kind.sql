-- System messages in house chat ("Rahul changed the house currency to EUR"),
-- the WhatsApp pattern for group-setting changes. They're ordinary rows
-- authored by the person who made the change, flagged so the chat renders
-- them as centred grey notices rather than speech bubbles.
--
-- Additive with a default, so existing rows and the currently-live app (which
-- never selects or sets this) are unaffected.
alter table public.messages
  add column if not exists kind text not null default 'user'
  check (kind in ('user', 'system'));
