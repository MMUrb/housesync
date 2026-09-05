// A house's chat was just read on this client. The chat page fires it so the
// house switcher can clear that house's unread badge immediately, without
// waiting for the next server render of the layout snapshot.
export const CHAT_READ_EVENT = "housesync:chat-read";

export type ChatReadDetail = { houseId: string };

export function emitChatRead(houseId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatReadDetail>(CHAT_READ_EVENT, { detail: { houseId } }));
}

/**
 * A message arrived that the open chat deliberately did NOT take (a thread
 * opened at an old message from search holds back live inserts). The nav
 * suppresses its own increment while the chat is on screen, so it needs
 * telling that this one is genuinely unread.
 */
export const CHAT_UNREAD_EVENT = "housesync:chat-unread";

export function emitChatUnread(houseId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatReadDetail>(CHAT_UNREAD_EVENT, { detail: { houseId } }));
}
