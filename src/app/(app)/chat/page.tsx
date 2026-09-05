import { requireHouse, getMessages, getMessageWindow } from "@/lib/data";
import { Chat } from "@/components/chat/Chat";

export const metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

// ?m=<message id> (from search) opens the thread AT that message: a window
// of history either side of it rather than the newest 100, with the message
// highlighted. Older history still pages in above; "Jump to latest" gets
// you back to the live end.
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { user, house, members } = await requireHouse();
  const { m } = await searchParams;

  if (m) {
    const win = await getMessageWindow(house.id, m);
    if (win) {
      return (
        <Chat
          key={`at-${m}`}
          houseId={house.id}
          currentUserId={user.id}
          initialMessages={win.messages}
          members={members}
          openAtId={m}
          initialHasMore={win.hasMoreOlder}
          initialHasNewer={win.hasMoreNewer}
        />
      );
    }
    // Unknown or deleted message: fall through to the normal thread.
  }

  const messages = await getMessages(house.id);
  return (
    <Chat
      key="live"
      houseId={house.id}
      currentUserId={user.id}
      initialMessages={messages}
      members={members}
    />
  );
}
