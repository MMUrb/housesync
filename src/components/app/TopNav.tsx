"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  IconBroom,
  IconCart,
  IconChat,
  IconHome,
  IconReceipt,
  IconRepeat,
  IconUsers,
} from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", label: "Home", Icon: IconHome },
  { href: "/expenses", label: "Expenses", Icon: IconReceipt },
  { href: "/bills", label: "Bills", Icon: IconRepeat },
  { href: "/shopping", label: "Shop", Icon: IconCart },
  { href: "/chores", label: "Chores", Icon: IconBroom },
  { href: "/housemates", label: "House", Icon: IconUsers },
  { href: "/chat", label: "Chat", Icon: IconChat },
];

export function TopNav({
  houseId,
  userId,
  initialUnreadCount,
}: {
  houseId: string;
  userId: string;
  initialUnreadCount: number;
}) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const onChat = pathname === "/chat" || pathname.startsWith("/chat/");
  // Keep the latest "am I on chat?" readable inside the realtime callback
  // without resubscribing on every navigation.
  const onChatRef = useRef(onChat);
  useEffect(() => {
    onChatRef.current = onChat;
    // Opening the chat clears the badge immediately (the chat page marks it read).
    if (onChat) setUnreadCount(0);
  }, [onChat]);

  // Live: light the dot when a message from someone else lands while you're
  // looking at another tab. Same-account other devices clear it on next load.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`nav-unread:${houseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `house_id=eq.${houseId}`,
        },
        (payload) => {
          const m = payload.new as { user_id: string };
          if (m.user_id !== userId && !onChatRef.current) setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [houseId, userId]);

  return (
    <nav className="border-t border-slate-100">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          const showBadge = href === "/chat" && unreadCount > 0 && !active;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <span className="relative">
                <Icon className="h-5 w-5" />
                {showBadge && (
                  <span
                    aria-label={`${unreadCount} unread message${unreadCount === 1 ? "" : "s"}`}
                    className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-[var(--background)]"
                  >
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
