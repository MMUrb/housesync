"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveHouse } from "@/lib/activeHouse";
import { createClient } from "@/lib/supabase/client";
import { CHAT_READ_EVENT, type ChatReadDetail } from "@/lib/chatRead";
import { IconChevronDown, IconCheck, IconPlus } from "@/components/icons";
import type { House } from "@/lib/types";

function UnreadBadge({ count }: { count: number }) {
  return (
    <span
      aria-label={`${count} unread message${count === 1 ? "" : "s"}`}
      className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-none text-white"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

// Each house gets a stable colour from its id, so the tiles are recognisable
// at a glance and never shuffle between renders.
const TILE_COLOURS = [
  "from-brand-400 to-brand-700",
  "from-mint-400 to-mint-700",
  "from-amber-400 to-orange-600",
  "from-sky-400 to-blue-600",
  "from-pink-400 to-rose-600",
  "from-violet-400 to-purple-700",
];
function tileColour(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return TILE_COLOURS[h % TILE_COLOURS.length];
}
function houseInitial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

export function HouseSwitcher({
  current,
  houses,
  userId,
  unreadByHouse,
}: {
  current: House;
  houses: House[];
  userId: string;
  unreadByHouse: Record<string, number>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Surface unread waiting in the user's OTHER houses (the active house's unread
  // is shown live on the Chat tab). Seeded from the server snapshot, then kept
  // live: cleared when its chat is read, bumped when a message lands.
  const [counts, setCounts] = useState(unreadByHouse);
  useEffect(() => setCounts(unreadByHouse), [unreadByHouse]);

  const otherUnread = houses
    .filter((h) => h.id !== current.id)
    .reduce((sum, h) => sum + (counts[h.id] ?? 0), 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Reading a house's chat clears its badge straight away.
  useEffect(() => {
    function onRead(e: Event) {
      const id = (e as CustomEvent<ChatReadDetail>).detail?.houseId;
      if (id) setCounts((c) => ({ ...c, [id]: 0 }));
    }
    window.addEventListener(CHAT_READ_EVENT, onRead);
    return () => window.removeEventListener(CHAT_READ_EVENT, onRead);
  }, []);

  // Live: bump a house's badge when a message from someone else lands there
  // while you're elsewhere. The active house is handled by the Chat tab. RLS
  // means we only receive messages for houses this user belongs to.
  const currentIdRef = useRef(current.id);
  useEffect(() => {
    currentIdRef.current = current.id;
  }, [current.id]);
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`switcher-unread:${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const m = payload.new as { user_id: string; house_id: string };
          if (m.user_id === userId || m.house_id === currentIdRef.current) return;
          setCounts((c) => ({ ...c, [m.house_id]: (c[m.house_id] ?? 0) + 1 }));
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  function choose(id: string) {
    setOpen(false);
    if (id === current.id) return;
    setActiveHouse(id);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[60vw] items-center gap-1 rounded-lg px-1.5 py-1 text-left hover:bg-slate-100 dark:hover:bg-white/[0.06]"
      >
        <span className="truncate text-lg font-bold text-slate-900">{current.name}</span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        {otherUnread > 0 && (
          <span
            aria-label="Unread messages in another house"
            className="h-2 w-2 shrink-0 rounded-full bg-red-500"
          />
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1.5 w-[17rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#15152b]">
          <p className="px-3 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
            Your houses
          </p>
          <ul className="pb-1">
            {houses.map((h) => {
              const count = counts[h.id] ?? 0;
              const active = h.id === current.id;
              return (
                <li key={h.id}>
                  <button
                    onClick={() => choose(h.id)}
                    // text-left matters: buttons centre their text by default,
                    // which pushed the house names into the middle of the row.
                    className={`flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.06] ${
                      active
                        ? "bg-brand-50 shadow-[inset_2px_0_0_theme(colors.brand.600)] dark:bg-brand-500/[0.16]"
                        : ""
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br text-[13px] font-extrabold text-white ${tileColour(h.id)}`}
                    >
                      {houseInitial(h.name)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        active ? "font-bold text-slate-900" : "text-slate-700"
                      }`}
                    >
                      {h.name}
                    </span>
                    {active ? (
                      <IconCheck className="h-4 w-4 shrink-0 text-brand-600" />
                    ) : (
                      count > 0 && <UnreadBadge count={count} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href="/house/create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.06]"
          >
            <IconPlus className="h-4 w-4" />
            Create or join another house
          </Link>
        </div>
      )}
    </div>
  );
}
