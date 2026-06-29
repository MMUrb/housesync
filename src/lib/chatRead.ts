// A house's chat was just read on this client. The chat page fires it so the
// house switcher can clear that house's unread badge immediately, without
// waiting for the next server render of the layout snapshot.
export const CHAT_READ_EVENT = "housesync:chat-read";

export type ChatReadDetail = { houseId: string };

export function emitChatRead(houseId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatReadDetail>(CHAT_READ_EVENT, { detail: { houseId } }));
}
