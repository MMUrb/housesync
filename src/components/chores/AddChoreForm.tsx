"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { todayISO } from "@/lib/recurrence";
import { CHORE_REPEATS, type ChoreRepeat, type MemberWithProfile } from "@/lib/types";
import { Select } from "@/components/Select";

export function AddChoreForm({
  houseId,
  currentUserId,
  members,
}: {
  houseId: string;
  currentUserId: string;
  members: MemberWithProfile[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [dueDate, setDueDate] = useState(todayISO());
  const [repeat, setRepeat] = useState<ChoreRepeat>("weekly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: insErr } = await supabase.from("chores").insert({
        house_id: houseId,
        title: title.trim(),
        assigned_to: assignedTo || null,
        due_date: dueDate || null,
        repeat,
        status: "todo",
        created_by: currentUserId,
      });
      if (insErr) throw insErr;

      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "chore_added",
        message: `added a chore: “${title.trim()}”`,
      });

      // Notify the assignee (best-effort), unless it's unassigned or yourself.
      if (assignedTo && assignedTo !== currentUserId) {
        void fetch("/api/push/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            type: "chore",
            houseId,
            title: title.trim(),
            toUserId: assignedTo,
          }),
        });
      }

      router.push("/chores");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the chore.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            Chore
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Take the bins out"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div>
          <label className="label" htmlFor="assigned">
            Assigned to
          </label>
          <Select
            id="assigned"
            ariaLabel="Assigned to"
            value={assignedTo}
            onChange={setAssignedTo}
            options={[
              { value: "", label: "Anyone" },
              ...members.map((m) => ({
                value: m.user_id,
                label: m.user_id === currentUserId ? "You" : m.profile?.name ?? "Housemate",
              })),
            ]}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="due">
              Due date
            </label>
            <input
              id="due"
              type="date"
              className="input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="repeat">
              Repeat
            </label>
            <Select
              id="repeat"
              ariaLabel="Repeat"
              value={repeat}
              onChange={(v) => setRepeat(v as ChoreRepeat)}
              options={CHORE_REPEATS.map((r) => ({ value: r.value, label: r.label }))}
            />
          </div>
        </div>
        {repeat !== "once" && (
          <p className="text-xs text-slate-500">
            When someone marks this done, the next one is created automatically and rotated to the
            next housemate.
          </p>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary btn-block">
        {loading ? "Saving…" : "Add chore"}
      </button>
    </form>
  );
}
