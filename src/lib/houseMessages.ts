// A single house-level Realtime subscription (HouseRealtime, mounted once in the
// app layout) streams every new chat message the user is allowed to see and
// re-broadcasts it on the window as this event. The chat view, the nav unread
// badge and the house-switcher badges all listen here instead of each opening
// their own Supabase Realtime channel — cutting ~4 channels per user down to 1,
// which is the main Realtime-connection scaling lever.
import type { Message } from "@/lib/types";

export const HOUSE_MESSAGE_EVENT = "housesync:message";

export function emitHouseMessage(message: Message): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Message>(HOUSE_MESSAGE_EVENT, { detail: message }));
}

/** Subscribe to new house messages. Returns an unsubscribe function. */
export function onHouseMessage(handler: (message: Message) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<Message>).detail);
  window.addEventListener(HOUSE_MESSAGE_EVENT, listener);
  return () => window.removeEventListener(HOUSE_MESSAGE_EVENT, listener);
}
