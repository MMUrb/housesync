"use client";

import type { ComponentType } from "react";
import { CHAT_READ_EVENT, type ChatReadDetail } from "@/lib/chatRead";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  IconBroom,
  IconCart,
  IconChat,
  IconHome,
  IconPlus,
  IconReceipt,
  IconRepeat,
  IconUsers,
} from "@/components/icons";

type IconType = ComponentType<{ className?: string }>;
type Tab = { href: string; label: string; Icon: IconType; match: string[] };

// Four primary destinations. Money groups Expenses + Bills; House is the hub for
// housemates, chores and shopping. Everything else is one tap deeper (via the
// home widgets, the Money sub-tabs, or the House hub) — see nav redesign.
const TABS: Tab[] = [
  { href: "/dashboard", label: "Home", Icon: IconHome, match: ["/dashboard"] },
  { href: "/expenses", label: "Money", Icon: IconReceipt, match: ["/expenses", "/bills"] },
  { href: "/housemates", label: "House", Icon: IconUsers, match: ["/housemates", "/chores", "/shopping"] },
  { href: "/chat", label: "Chat", Icon: IconChat, match: ["/chat"] },
];

// The central "+" quick-add menu.
const QUICK_ADD: { href: string; label: string; Icon: IconType }[] = [
  { href: "/expenses/new", label: "Add expense", Icon: IconReceipt },
  { href: "/bills/new", label: "Add bill", Icon: IconRepeat },
  { href: "/chores/new", label: "Add chore", Icon: IconBroom },
  { href: "/shopping", label: "Add shopping item", Icon: IconCart },
];

function matches(pathname: string, paths: string[]) {
  return paths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

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
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLDivElement>(null);

  // Clear the badge when the chat actually marks itself read (it emits this
  // exactly when the watermark is written), not merely on landing on /chat:
  // a thread opened at an old message from search deliberately leaves the
  // watermark alone until you reach the live end.
  useEffect(() => {
    function onRead(e: Event) {
      if ((e as CustomEvent<ChatReadDetail>).detail?.houseId === houseId) setUnreadCount(0);
    }
    window.addEventListener(CHAT_READ_EVENT, onRead);
    return () => window.removeEventListener(CHAT_READ_EVENT, onRead);
  }, [houseId]);


  // Close the quick-add menu when navigating.
  useEffect(() => setAddOpen(false), [pathname]);

  // Close the quick-add menu on an outside tap.
  useEffect(() => {
    if (!addOpen) return;
    function onDown(e: MouseEvent) {
      if (addRef.current && !addRef.current.contains(e.target as Node)) setAddOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [addOpen]);

  // Live: light the Chat dot when a message from someone else lands while you're
  // on another tab. Same-account other devices clear it on next load.
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
          // Counted even while the chat is open: the tab hides its own badge
          // when active, and the chat's read event zeroes this the moment it
          // actually marks the thread read. Anything it does NOT mark read
          // (reader scrolled up, or a window opened at an old message) then
          // survives correctly to the moment you leave.
          if (m.user_id !== userId) setUnreadCount((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [houseId, userId]);

  function renderTab(t: Tab) {
    const active = matches(pathname, t.match);
    const showBadge = t.href === "/chat" && unreadCount > 0 && !active;
    const Icon = t.Icon;
    return (
      <Link
        key={t.href}
        href={t.href}
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
        {t.label}
      </Link>
    );
  }

  return (
    <nav data-app-nav className="border-t border-slate-100">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {renderTab(TABS[0])}
        {renderTab(TABS[1])}

        {/* Central quick-add */}
        <div ref={addRef} className="relative flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={() => setAddOpen((o) => !o)}
            aria-label="Quick add"
            aria-expanded={addOpen}
            className="grid h-10 w-10 place-items-center rounded-full bg-brand-600 text-white shadow-card transition hover:bg-brand-700 active:scale-95"
          >
            <IconPlus className="h-5 w-5" />
          </button>
          {addOpen && (
            <div
              data-quickadd
              className="absolute left-1/2 top-full z-50 mt-1.5 w-56 -translate-x-1/2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#15152b]"
            >
              {QUICK_ADD.map(({ href, label, Icon }) => (
                <Link
                  key={label}
                  href={href}
                  className="flex items-center gap-3 px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
                >
                  <Icon className="h-4 w-4 text-brand-600" />
                  {label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {renderTab(TABS[2])}
        {renderTab(TABS[3])}
      </div>
    </nav>
  );
}
