"use client";

import { useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/types";

export interface ExpenseVM {
  id: string;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  paidByName: string;
  paidByYou: boolean;
  impactKind: "owe" | "owed" | "settled" | "none";
  impactAmount: number;
}

const CAT_META: Record<ExpenseCategory, { emoji: string; label: string }> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, { emoji: c.emoji, label: c.label }]),
) as Record<ExpenseCategory, { emoji: string; label: string }>;

export function ExpensesList({ rows, currency }: { rows: ExpenseVM[]; currency: string }) {
  const [cat, setCat] = useState<"all" | ExpenseCategory>("all");
  const filtered = cat === "all" ? rows : rows.filter((r) => r.category === cat);

  const tabs: ("all" | ExpenseCategory)[] = [
    "all",
    ...EXPENSE_CATEGORIES.map((c) => c.value).filter((v) => rows.some((r) => r.category === v)),
  ];

  return (
    <div>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setCat(t)}
            className={`chip shrink-0 border ${
              cat === t
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t === "all" ? "All" : `${CAT_META[t].emoji} ${CAT_META[t].label}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">No expenses here yet.</div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {filtered.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3.5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">
                {CAT_META[r.category]?.emoji ?? "📦"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                <p className="text-xs text-slate-500">
                  {r.paidByYou ? "You paid" : `${r.paidByName} paid`} · {formatDate(r.date)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-slate-800">
                  {formatMoney(r.amount, currency)}
                </p>
                <p
                  className={`text-xs font-medium ${
                    r.impactKind === "owe"
                      ? "text-red-600"
                      : r.impactKind === "owed"
                        ? "text-mint-600"
                        : "text-slate-400"
                  }`}
                >
                  {r.impactKind === "owe" && `you owe ${formatMoney(r.impactAmount, currency)}`}
                  {r.impactKind === "owed" && `you're owed ${formatMoney(r.impactAmount, currency)}`}
                  {r.impactKind === "settled" && "settled"}
                  {r.impactKind === "none" && "not involved"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
