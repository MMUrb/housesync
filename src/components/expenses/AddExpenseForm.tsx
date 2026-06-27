"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { splitEqually } from "@/lib/balances";
import { formatMoney, currencySymbol } from "@/lib/format";
import { type SplitType } from "@/lib/types";

type Cat = { code: string; name: string; emoji: string; color: string };
import type { MemberWithProfile } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Select } from "@/components/Select";

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function AddExpenseForm({
  houseId,
  currentUserId,
  currency,
  members,
  categories,
}: {
  houseId: string;
  currentUserId: string;
  currency: string;
  members: MemberWithProfile[];
  categories: Cat[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [paidBy, setPaidBy] = useState(currentUserId);
  const [category, setCategory] = useState<string>(
    (categories.find((c) => c.code === "bills") ?? categories[0])?.code ?? "bills",
  );
  const [date, setDate] = useState(today());
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(members.map((m) => m.user_id)),
  );
  const [splitType, setSplitType] = useState<SplitType>("equal");
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountNum = Number(amount) || 0;
  const selectedIds = members.map((m) => m.user_id).filter((id) => selected.has(id));

  // Compute each selected member's share based on the split type.
  const shares = useMemo(() => {
    const map: Record<string, number> = {};
    if (selectedIds.length === 0) return map;
    if (splitType === "equal") {
      const parts = splitEqually(amountNum, selectedIds.length);
      selectedIds.forEach((id, i) => (map[id] = parts[i]));
    } else if (splitType === "custom") {
      selectedIds.forEach((id) => (map[id] = Number(custom[id]) || 0));
    } else {
      // percentage
      selectedIds.forEach((id) => {
        const pct = Number(custom[id]) || 0;
        map[id] = Math.round(amountNum * pct) / 100;
      });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, splitType, custom, Array.from(selected).join(","), members.length]);

  const sharesTotal = selectedIds.reduce((s, id) => s + (shares[id] ?? 0), 0);
  const pctTotal = selectedIds.reduce((s, id) => s + (Number(custom[id]) || 0), 0);

  const splitValid =
    splitType === "equal" ||
    (splitType === "custom" && Math.abs(sharesTotal - amountNum) < 0.02) ||
    (splitType === "percentage" && Math.abs(pctTotal - 100) < 0.5);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (amountNum <= 0) return setError("Enter an amount greater than zero.");
    if (selectedIds.length === 0) return setError("Pick at least one person to split with.");
    if (!splitValid) {
      return setError(
        splitType === "percentage"
          ? "Percentages need to add up to 100%."
          : `Custom amounts need to add up to ${formatMoney(amountNum, currency)}.`,
      );
    }

    setLoading(true);
    try {
      // 1. Optional receipt upload.
      let receiptUrl: string | null = null;
      if (receipt) {
        const safe = receipt.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const path = `${houseId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, receipt);
        if (upErr) throw upErr;
        // Receipts live in a PRIVATE bucket, so store the storage path (not a
        // public URL). View it later via a short-lived signed URL.
        receiptUrl = path;
      }

      // 2. Create the expense.
      const { data: expense, error: expErr } = await supabase
        .from("expenses")
        .insert({
          house_id: houseId,
          title: title.trim(),
          amount: amountNum,
          category,
          paid_by: paidBy,
          split_type: splitType,
          date,
          receipt_url: receiptUrl,
          notes: notes.trim() || null,
          created_by: currentUserId,
        })
        .select()
        .single();
      if (expErr) throw expErr;

      // 3. Create the splits (payer's own share is auto-confirmed).
      const now = new Date().toISOString();
      const rows = selectedIds.map((id) => ({
        expense_id: expense.id,
        user_id: id,
        amount_owed: shares[id] ?? 0,
        status: id === paidBy ? "confirmed" : "unpaid",
        paid_at: id === paidBy ? now : null,
        confirmed_at: id === paidBy ? now : null,
      }));
      const { error: splitErr } = await supabase.from("expense_splits").insert(rows);
      if (splitErr) throw splitErr;

      // 4. Activity entry.
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "expense_added",
        message: `added “${title.trim()}” (${formatMoney(amountNum, currency)})`,
      });

      // Notify the house (best-effort).
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "expense",
          houseId,
          title: title.trim(),
          amount: formatMoney(amountNum, currency),
        }),
      });

      router.push("/expenses");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the expense.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="title">
            What was it?
          </label>
          <input
            id="title"
            className="input"
            placeholder="e.g. Wi-Fi bill"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />
        </div>

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

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="paidby">
              Paid by
            </label>
            <Select
              id="paidby"
              ariaLabel="Paid by"
              value={paidBy}
              onChange={setPaidBy}
              options={members.map((m) => ({
                value: m.user_id,
                label: m.user_id === currentUserId ? "You" : m.profile?.name ?? "Housemate",
              }))}
            />
          </div>
          <div>
            <label className="label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <CategoryPicker
          houseId={houseId}
          categories={categories}
          value={category}
          onChange={setCategory}
        />
      </div>

      {/* Split */}
      <div className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <span className="label mb-0">Split between</span>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            {(["equal", "custom", "percentage"] as SplitType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSplitType(t)}
                className={`rounded-md px-2.5 py-1 capitalize transition ${
                  splitType === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                {t === "percentage" ? "%" : t}
              </button>
            ))}
          </div>
        </div>

        <ul className="space-y-1.5">
          {members.map((m) => {
            const on = selected.has(m.user_id);
            return (
              <li
                key={m.user_id}
                className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                  on ? "border-slate-200 bg-white" : "border-transparent opacity-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggle(m.user_id)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-md border ${
                      on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"
                    }`}
                  >
                    {on && "✓"}
                  </span>
                  <Avatar name={m.profile?.name} color={m.profile?.avatar_color} avatarUrl={m.profile?.avatar_url} size="sm" />
                  <span className="truncate text-sm text-slate-800">
                    {m.user_id === currentUserId ? "You" : m.profile?.name ?? "Housemate"}
                  </span>
                </button>

                {on && splitType === "equal" && (
                  <span className="shrink-0 text-sm font-medium text-slate-500">
                    {formatMoney(shares[m.user_id] ?? 0, currency)}
                  </span>
                )}
                {on && splitType !== "equal" && (
                  <div className="relative w-24 shrink-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      step={splitType === "percentage" ? "1" : "0.01"}
                      min="0"
                      className="input py-1.5 pr-7 text-right text-sm"
                      placeholder="0"
                      value={custom[m.user_id] ?? ""}
                      onChange={(e) =>
                        setCustom((p) => ({ ...p, [m.user_id]: e.target.value }))
                      }
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {splitType === "percentage" ? "%" : currencySymbol(currency)}
                    </span>
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        {/* Split totals helper */}
        {splitType !== "equal" && selectedIds.length > 0 && (
          <p className={`text-xs ${splitValid ? "text-slate-400" : "text-red-500"}`}>
            {splitType === "percentage"
              ? `Total: ${pctTotal}% of 100%`
              : `Total: ${formatMoney(sharesTotal, currency)} of ${formatMoney(amountNum, currency)}`}
          </p>
        )}
      </div>

      {/* Extras */}
      <div className="card space-y-4 p-5">
        <div>
          <label className="label" htmlFor="receipt">
            Receipt photo <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="receipt"
            type="file"
            accept="image/*"
            onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100"
          />
        </div>
        <div>
          <label className="label" htmlFor="notes">
            Note <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <textarea
            id="notes"
            className="input min-h-[72px] resize-y"
            placeholder="Anything worth remembering?"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="sticky bottom-4 z-10">
        <button type="submit" disabled={loading} className="btn-primary btn-block shadow-soft">
          {loading ? "Saving…" : "Add expense"}
        </button>
      </div>
    </form>
  );
}
