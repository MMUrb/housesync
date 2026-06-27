"use client";

import { useState } from "react";
import { ChoreItem } from "@/components/chores/ChoreItem";
import type { Chore, MemberWithProfile } from "@/lib/types";

type Horizon = "today" | "week" | "month" | "all";

const HORIZONS: { key: Horizon; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All" },
];

// Date cutoffs (today / weekISO / monthISO) are computed on the server and
// passed in as yyyy-mm-dd strings, so every comparison here is a plain string
// compare — no Date math during render, hence no SSR/hydration mismatch.
export function ChoresList({
  chores,
  members,
  currentUserId,
  today,
  weekISO,
  monthISO,
}: {
  chores: Chore[];
  members: MemberWithProfile[];
  currentUserId: string;
  today: string;
  weekISO: string;
  monthISO: string;
}) {
  const todo = chores.filter((c) => c.status === "todo");
  const done = chores.filter((c) => c.status === "done");

  const [tab, setTab] = useState<"upcoming" | "completed">(
    todo.length > 0 ? "upcoming" : "completed",
  );
  const [horizon, setHorizon] = useState<Horizon>("all");

  const cutoffFor = (h: Horizon): string | null =>
    h === "today" ? today : h === "week" ? weekISO : h === "month" ? monthISO : null;

  // Upcoming chores within a horizon. Overdue ones always count (still
  // outstanding); undated chores only appear under "All".
  const inScope = (h: Horizon) => {
    const cutoff = cutoffFor(h);
    return todo.filter((c) => {
      if (!c.due_date) return cutoff === null;
      if (c.due_date < today) return true;
      return cutoff === null || c.due_date <= cutoff;
    });
  };

  const scoped = inScope(horizon);

  const sections: { label: string; items: Chore[] }[] = [
    { label: "Overdue", items: scoped.filter((c) => c.due_date && c.due_date < today) },
    { label: "Today", items: scoped.filter((c) => c.due_date === today) },
    {
      label: "This week",
      items: scoped.filter((c) => c.due_date && c.due_date > today && c.due_date <= weekISO),
    },
    {
      label: "Later",
      items: scoped.filter((c) => !c.due_date || (c.due_date && c.due_date > weekISO)),
    },
  ];

  const completed = [...done]
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 30);

  const emptyWhen =
    horizon === "today"
      ? "today"
      : horizon === "week"
        ? "this week"
        : horizon === "month"
          ? "this month"
          : "yet";

  return (
    <div>
      <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
        {([
          ["upcoming", todo.length],
          ["completed", done.length],
        ] as const).map(([key, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 capitalize transition ${
              tab === key
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
                : "text-slate-500"
            }`}
          >
            {key} ({count})
          </button>
        ))}
      </div>

      {tab === "upcoming" ? (
        <>
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {HORIZONS.map((h) => {
              const active = horizon === h.key;
              return (
                <button
                  key={h.key}
                  onClick={() => setHorizon(h.key)}
                  className={`chip shrink-0 border ${
                    active
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                >
                  {h.label} ({inScope(h.key).length})
                </button>
              );
            })}
          </div>

          {scoped.length === 0 ? (
            <div className="card p-6 text-center text-sm text-slate-500">
              Nothing due {emptyWhen}. 🎉
            </div>
          ) : (
            <div className="space-y-5">
              {sections.map(
                (s) =>
                  s.items.length > 0 && (
                    <section key={s.label} className="space-y-2">
                      <h2 className="px-1 text-sm font-semibold text-slate-900">
                        {s.label}{" "}
                        <span className="font-normal text-slate-400">({s.items.length})</span>
                      </h2>
                      <ul className="card divide-y divide-slate-100">
                        {s.items.map((c) => (
                          <ChoreItem
                            key={c.id}
                            chore={c}
                            members={members}
                            currentUserId={currentUserId}
                            today={today}
                          />
                        ))}
                      </ul>
                    </section>
                  ),
              )}
            </div>
          )}
        </>
      ) : completed.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          No completed chores yet.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {completed.map((c) => (
            <ChoreItem
              key={c.id}
              chore={c}
              members={members}
              currentUserId={currentUserId}
              today={today}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
