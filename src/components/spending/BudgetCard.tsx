"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencySymbol, formatMoney } from "@/lib/format";

export function BudgetCard({
  userId,
  currency,
  spentThisMonth,
  initialBudget,
}: {
  userId: string;
  currency: string;
  spentThisMonth: number;
  initialBudget: number | null;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [budget, setBudget] = useState<number | null>(initialBudget);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialBudget != null ? String(initialBudget) : "");
  const [saving, setSaving] = useState(false);

  async function save(value: number | null) {
    setSaving(true);
    await supabase
      .from("account_settings")
      .upsert({ user_id: userId, monthly_budget: value }, { onConflict: "user_id" });
    setBudget(value);
    setEditing(false);
    setSaving(false);
    router.refresh();
  }

  function onSave() {
    const v = Number(draft);
    if (!Number.isFinite(v) || v <= 0) return;
    void save(Math.round(v * 100) / 100);
  }

  if (editing) {
    return (
      <div className="card p-4">
        <p className="mb-2 text-sm font-medium text-slate-800">Monthly budget</p>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              {currencySymbol(currency)}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSave()}
              placeholder="250"
              autoFocus
              className="input pl-7"
            />
          </div>
          <button onClick={onSave} disabled={saving} className="btn-primary px-4 py-2 text-sm">
            {saving ? "…" : "Save"}
          </button>
          <button onClick={() => setEditing(false)} className="btn-secondary px-3 py-2 text-sm">
            Cancel
          </button>
        </div>
        {budget != null && (
          <button
            onClick={() => void save(null)}
            className="mt-2 text-xs font-medium text-slate-400 hover:text-red-500"
          >
            Remove budget
          </button>
        )}
      </div>
    );
  }

  if (budget == null) {
    return (
      <div className="card flex items-center justify-between gap-3 p-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Monthly budget</p>
          <p className="text-xs text-slate-500">Set a target to track your spending each month.</p>
        </div>
        <button
          onClick={() => {
            setDraft("");
            setEditing(true);
          }}
          className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
        >
          Set budget
        </button>
      </div>
    );
  }

  const pct = budget > 0 ? (spentThisMonth / budget) * 100 : 0;
  const over = spentThisMonth > budget;
  const remaining = budget - spentThisMonth;
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-amber-500" : "bg-mint-500";

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-800">Monthly budget</p>
        <button
          onClick={() => {
            setDraft(String(budget));
            setEditing(true);
          }}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          Edit
        </button>
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-bold text-slate-900">{formatMoney(spentThisMonth, currency)}</span>
        <span className="text-sm text-slate-400">of {formatMoney(budget, currency)} this month</span>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className={`mt-1.5 text-xs font-medium ${over ? "text-red-600" : "text-slate-500"}`}>
        {over
          ? `${formatMoney(Math.abs(remaining), currency)} over budget`
          : `${formatMoney(remaining, currency)} left · ${Math.round(pct)}% used`}
      </p>
    </div>
  );
}
