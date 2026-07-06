"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { advanceDate, todayISO } from "@/lib/recurrence";
import { relativeDay, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { IconCheck } from "@/components/icons";
import { CHORE_REPEATS, type Chore, type MemberWithProfile } from "@/lib/types";

const REPEAT_LABEL = Object.fromEntries(CHORE_REPEATS.map((r) => [r.value, r.label]));

function nextAssignee(members: MemberWithProfile[], current: string | null): string | null {
  if (members.length === 0) return null;
  if (!current) return null;
  const idx = members.findIndex((m) => m.user_id === current);
  if (idx < 0) return members[0].user_id;
  return members[(idx + 1) % members.length].user_id;
}

export function ChoreItem({
  chore,
  members,
  currentUserId,
  today,
}: {
  chore: Chore;
  members: MemberWithProfile[];
  currentUserId: string;
  // Server's yyyy-mm-dd, so the overdue check is a string compare (no Date math
  // at render time, hence no SSR/hydration mismatch).
  today: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close the options menu on an outside tap.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(ev: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  const assignee = members.find((m) => m.user_id === chore.assigned_to);
  const done = chore.status === "done";
  const overdue = !done && !!chore.due_date && chore.due_date < today;

  async function markDone() {
    setLoading(true);
    try {
      const now = new Date().toISOString();
      await supabase
        .from("chores")
        .update({ status: "done", completed_at: now, completed_by: currentUserId })
        .eq("id", chore.id);

      // Spawn the next occurrence for repeating chores, rotated to the next person.
      if (chore.repeat !== "once") {
        const base = chore.due_date ?? todayISO();
        await supabase.from("chores").insert({
          house_id: chore.house_id,
          title: chore.title,
          assigned_to: nextAssignee(members, chore.assigned_to),
          due_date: advanceDate(base, chore.repeat),
          repeat: chore.repeat,
          status: "todo",
          created_by: currentUserId,
        });
      }

      await supabase.from("activity").insert({
        house_id: chore.house_id,
        user_id: currentUserId,
        type: "chore_done",
        message: `ticked off “${chore.title}”`,
      });

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  // Undo an accidental tap: put the chore back to "todo". Marking a repeating
  // chore done also spawns its next occurrence, so remove that spawn too or the
  // undo would leave a duplicate. Match it on title/repeat and the date the
  // spawn was given (best-effort; a leftover just means one extra to tidy).
  async function markUndone() {
    setLoading(true);
    try {
      await supabase
        .from("chores")
        .update({ status: "todo", completed_at: null, completed_by: null })
        .eq("id", chore.id);

      if (chore.repeat !== "once") {
        const base = chore.due_date ?? chore.completed_at?.slice(0, 10) ?? todayISO();
        const spawnedDue = advanceDate(base, chore.repeat);
        const { data: dupes } = await supabase
          .from("chores")
          .select("id")
          .eq("house_id", chore.house_id)
          .eq("title", chore.title)
          .eq("repeat", chore.repeat)
          .eq("status", "todo")
          .eq("due_date", spawnedDue)
          .order("created_at", { ascending: false })
          .limit(1);
        if (dupes?.[0]) {
          await supabase.from("chores").delete().eq("id", dupes[0].id);
        }
      }

      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setMenuOpen(false);
    if (!confirm(`Delete “${chore.title}”? This can't be undone.`)) return;
    setLoading(true);
    try {
      await supabase.from("chores").delete().eq("id", chore.id);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="flex items-center gap-3 p-3.5">
      {done ? (
        <button
          onClick={markUndone}
          disabled={loading}
          aria-label="Undo, mark as not done"
          title="Undo"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-100 text-mint-600 transition hover:opacity-80 disabled:opacity-50"
        >
          <IconCheck className="h-5 w-5" />
        </button>
      ) : (
        <button
          onClick={markDone}
          disabled={loading}
          aria-label="Mark as done"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-slate-300 text-transparent transition hover:border-mint-500 hover:text-mint-500 disabled:opacity-50"
        >
          <IconCheck className="h-5 w-5" />
        </button>
      )}

      <div className="min-w-0 flex-1">
        <p className={`truncate text-sm font-medium ${done ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {chore.title}
        </p>
        <p className="text-xs text-slate-500">
          {done
            ? `Done ${chore.completed_at ? timeAgo(chore.completed_at) : ""}`
            : chore.due_date && (
                <span className={overdue ? "font-medium text-red-500" : ""}>
                  {relativeDay(chore.due_date)}
                </span>
              )}
          {!done && chore.repeat !== "once" && (
            <span className="text-slate-400"> · {REPEAT_LABEL[chore.repeat]}</span>
          )}
        </p>
      </div>

      {assignee ? (
        <Avatar name={assignee.profile?.name} color={assignee.profile?.avatar_color} avatarUrl={assignee.profile?.avatar_url} size="sm" />
      ) : (
        <span className="chip bg-slate-100 text-slate-500">Anyone</span>
      )}

      <div className="relative shrink-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Chore options"
          aria-expanded={menuOpen}
          className="grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
        >
          <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#15152b]">
            <Link
              href={`/chores/${chore.id}/edit`}
              className="block px-3.5 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:hover:bg-white/[0.06]"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="block w-full px-3.5 py-2.5 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-white/[0.06]"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    </li>
  );
}
