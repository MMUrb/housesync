-- Threaded replies in house chat: a message can reference the message it is
-- replying to. Nullable and ON DELETE SET NULL, so deleting the original just
-- drops the quote from any replies (they remain as normal messages). Additive
-- and backward-compatible: existing code that doesn't select it is unaffected.
alter table public.messages
  add column if not exists reply_to uuid references public.messages (id) on delete set null;

create index if not exists idx_messages_reply_to on public.messages (reply_to);
