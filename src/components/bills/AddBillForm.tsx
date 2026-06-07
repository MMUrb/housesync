"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencySymbol, formatMoney } from "@/lib/format";
import { defaultNextDue } from "@/lib/recurrence";
import {
  BILL_FREQUENCIES,
  EXPENSE_CATEGORIES,
  type BillFrequency,
  type ExpenseCategory,
  type MemberWithProfile,
} from "@/lib/types";

export function AddBillForm({
  houseId,
  currentUserId,
  currency,
  members,
}: {
  houseId: string;
  currentUserId: string;
  currency: string;
  members: MemberWithProfile[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("bills");
  const [frequency, setFrequency] = useState<BillFrequency>("monthly");
  const [nextDue, setNextDue] = useState(() => defaultNextDue("monthly"));
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [reminder, setReminder] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount) || 0;
  const perPerson = members.length > 0 ? amountNum / members.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountNum <= 0) return setError("Enter an amount greater than zero.");

    setLoading(true);
    try {
      const dueDay = nextDue ? new Date(`${nextDue}T00:00:00`).getDate() : null;
      const { error: insErr } = await supabase.from("recurring_bills").insert({
        house_id: houseId,
        title: title.trim(),
        amount: amountNum,
        category,
        frequency,
        due_day: dueDay,
        next_due_date: nextDue || null,
        paid_by: paidBy,
        split_type: "equal",
        reminder_enabled: reminder,
        active: true,
        created_by: currentUserId,
      });
      if (insErr) throw insErr;

      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "bill_added",
        message: `added a recurring bill: “${title.trim()}” (${formatMoney(amountNum, currency)} ${frequency})`,
      });

      router.push("/bills");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the bill.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            Bill name
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Wi-Fi"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="amount">
              Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                {currencySymbol(currency)}
              </span>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                className="input pl-7"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="frequency">
              Frequency
            </label>
            <select
              id="frequency"
              className="input"
              value={frequency}
              onChange={(e) => {
                const f = e.target.value as BillFrequency;
                setFrequency(f);
                setNextDue(defaultNextDue(f));
              }}
            >
              {BILL_FREQUENCIES.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="nextdue">
              Next due date
            </label>
            <input
              id="nextdue"
              type="date"
              className="input"
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor="paidby">
              Usually paid by
            </label>
            <select
              id="paidby"
              className="input"
              value={paidBy}
              onChange={(e) => setPaidBy(e.target.value)}
            >
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id === currentUserId ? "You" : m.profile?.name ?? "Housemate"}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <span className="label">Category</span>
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setCategory(c.value)}
                className={`chip border ${
                  category === c.value
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                <span>{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-sm font-medium text-slate-800">Reminders</p>
          <p className="text-xs text-slate-500">Surface this bill on the dashboard before it&apos;s due.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reminder}
          onClick={() => setReminder((r) => !r)}
          className={`relative h-6 w-11 rounded-full transition ${reminder ? "bg-brand-600" : "bg-slate-300"}`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${reminder ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>

      {amountNum > 0 && members.length > 0 && (
        <p className="px-1 text-center text-xs text-slate-500">
          Split equally, that&apos;s {formatMoney(perPerson, currency)} each across {members.length}{" "}
          {members.length === 1 ? "person" : "people"}.
        </p>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary btn-block">
        {loading ? "Saving…" : "Add recurring bill"}
      </button>
    </form>
  );
}
