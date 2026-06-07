"use client";

import { useState } from "react";
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
}: {
  chore: Chore;
  members: MemberWithProfile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);

  const assignee = members.find((m) => m.user_id === chore.assigned_to);
  const done = chore.status === "done";
  const overdue =
    !done && chore.due_date && new Date(chore.due_date) < new Date(new Date().toDateString());

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

  return (
    <li className="flex items-center gap-3 p-3.5">
      {done ? (
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-mint-100 text-mint-600">
          <IconCheck className="h-5 w-5" />
        </span>
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
    </li>
  );
}
