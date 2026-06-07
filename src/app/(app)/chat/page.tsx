import { requireHouse, getMessages } from "@/lib/data";
import { Chat } from "@/components/chat/Chat";

export const metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const { user, house, members } = await requireHouse();
  const messages = await getMessages(house.id);

  return (
    <Chat
      houseId={house.id}
      currentUserId={user.id}
      initialMessages={messages}
      members={members}
    />
  );
}
