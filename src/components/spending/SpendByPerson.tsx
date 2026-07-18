"use client";

import { useMemo } from "react";
import { formatMoney } from "@/lib/format";
import { Avatar } from "@/components/Avatar";

type Exp = { id: string; date: string };
type Split = { expense_id: string; user_id: string; amount_owed: number };
type Member = { id: string; name: string; color: string; avatarUrl: string | null };

// Per-person breakdown for the current calendar month: each housemate's share
// of the month's expenses, biggest first, as a coloured bar. Mirrors the card
// styling, avatar sizing and formatMoney use of the rest of the app.
export function SpendByPerson({
  expenses,
  splits,
  members,
  meId,
  currency,
}: {
  expenses: Exp[];
  splits: Split[];
  members: Member[];
  meId: string;
  currency: string;
}) {
  const now = new Date();
  const monthLabel = now.toLocaleString("en-GB", { month: "long" });

  const rows = useMemo(() => {
    const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
    const inMonth = new Set(
      expenses
        .filter((e) => {
          const t = new Date(`${e.date}T00:00:00`).getTime();
          return t >= start && t < end;
        })
        .map((e) => e.id),
    );
    const byUser = new Map<string, number>();
    for (const s of splits) {
      if (!inMonth.has(s.expense_id)) continue;
      byUser.set(s.user_id, (byUser.get(s.user_id) ?? 0) + Number(s.amount_owed));
    }
    return members
      .map((m) => ({ ...m, amount: byUser.get(m.id) ?? 0 }))
      .sort((a, b) => b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, splits, members]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const max = Math.max(0.01, ...rows.map((r) => r.amount));

  if (total === 0) {
    return (
      <div className="card p-4 text-center text-sm text-slate-500">
        No spending logged in {monthLabel} yet.
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-2xl font-bold text-slate-900">{formatMoney(total, currency)}</p>
        <p className="text-xs text-slate-500">{monthLabel}</p>
      </div>
      <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center gap-3">
            <Avatar name={r.name} color={r.color} avatarUrl={r.avatarUrl} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm text-slate-700">
                  {r.id === meId ? "You" : r.name}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {formatMoney(r.amount, currency)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.max(3, (r.amount / max) * 100)}%`, backgroundColor: r.color }}
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
