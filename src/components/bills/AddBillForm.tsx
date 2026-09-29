"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { currencySymbol, formatDate, formatMoney } from "@/lib/format";
import { defaultNextDue } from "@/lib/recurrence";
import { BILL_FREQUENCIES, type BillFrequency, type MemberWithProfile } from "@/lib/types";
import { REMINDER_DAY_OPTIONS } from "@/lib/billPortions";
import { CategoryPicker } from "@/components/categories/CategoryPicker";
import { Select } from "@/components/Select";

type Cat = { code: string; name: string; emoji: string; color: string };

// When present, the form edits an existing recurring bill instead of creating one.
export type BillEditInit = {
  billId: string;
  title: string;
  amount: number;
  category: string;
  frequency: BillFrequency;
  nextDue: string;
  /** The bill's payer (paid_by); "" when nobody (their account was deleted). */
  paidBy: string;
  /** The raw paid_by column, for the compare-and-swap on save. */
  storedPaidBy: string | null;
  /** The stored day-of-month anchor. */
  dueDay: number | null;
  reminder: boolean;
  reminderDays: number[];
  /** A cycle the engine already sent that is still ahead, if any. */
  pendingDue: string | null;
};

// A new bill that opens already filled in (the dashboard's rent-day card).
// dueDay is the anchor itself, which a clamped nextDue (the 30th for a
// "31st" in a 30-day month) can't carry.
export type BillPreset = {
  title: string;
  category: string;
  nextDue: string;
  dueDay: number;
};

// Everything an edit can change, as the form last knew it from the database.
type EditSnapshot = Omit<BillEditInit, "billId" | "pendingDue">;
const snapshotOf = (e: BillEditInit): EditSnapshot => ({
  title: e.title,
  amount: e.amount,
  category: e.category,
  frequency: e.frequency,
  nextDue: e.nextDue,
  paidBy: e.paidBy,
  storedPaidBy: e.storedPaidBy,
  dueDay: e.dueDay,
  reminder: e.reminder,
  reminderDays: [...e.reminderDays].sort((a, b) => b - a),
});
const sameSnapshot = (a: EditSnapshot, b: EditSnapshot) => JSON.stringify(a) === JSON.stringify(b);
const dayOf = (iso: string) => Number(iso.slice(8, 10));
const daysInMonthOf = (iso: string) =>
  new Date(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)), 0)).getUTCDate();

export function AddBillForm({
  houseId,
  currentUserId,
  currency,
  members,
  categories,
  edit,
  preset,
}: {
  houseId: string;
  currentUserId: string;
  currency: string;
  members: MemberWithProfile[];
  categories: Cat[];
  edit?: BillEditInit;
  preset?: BillPreset;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(edit?.title ?? preset?.title ?? "");
  const [amount, setAmount] = useState(edit ? String(edit.amount) : "");
  const [category, setCategory] = useState<string>(
    edit?.category ??
      (preset && categories.some((c) => c.code === preset.category) ? preset.category : undefined) ??
      (categories.find((c) => c.code === "bills") ?? categories[0])?.code ??
      "bills",
  );
  const [frequency, setFrequency] = useState<BillFrequency>(edit?.frequency ?? "monthly");
  const [nextDue, setNextDue] = useState(() => edit?.nextDue ?? preset?.nextDue ?? defaultNextDue("monthly"));
  const [paidBy, setPaidBy] = useState(edit?.paidBy ?? currentUserId);
  const [reminder, setReminder] = useState(edit?.reminder ?? true);
  const [reminderDays, setReminderDays] = useState<number[]>(edit?.reminderDays ?? [3, 0]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What the form was opened with, captured once: a live refresh replaces
  // the `edit` prop while the form keeps its state, so "what changed" and the
  // compare-and-swap must both be judged against this snapshot.
  const [baseline, setBaseline] = useState<EditSnapshot | null>(() => (edit ? snapshotOf(edit) : null));
  // After a refused save: the snapshot that was refused. The bill's current
  // values are adopted once, when they arrive (they differ from it), then
  // this disarms so later refreshes never overwrite what the user types.
  const [refused, setRefused] = useState<EditSnapshot | null>(null);
  const fresh = edit ? snapshotOf(edit) : null;
  const freshKey = fresh ? JSON.stringify(fresh) : "";
  useEffect(() => {
    if (!refused || !fresh || sameSnapshot(fresh, refused)) return;
    // Money fields that moved underneath are always replaced: the user must
    // look at them again before saving.
    if (fresh.nextDue !== refused.nextDue) setNextDue(fresh.nextDue);
    if (fresh.frequency !== refused.frequency) setFrequency(fresh.frequency);
    if (fresh.paidBy !== refused.paidBy) setPaidBy(fresh.paidBy);
    if (fresh.amount !== refused.amount) setAmount(String(fresh.amount));
    // Everything else follows too, unless the user had changed that field
    // themselves (then their edit stands); otherwise a stale value would be
    // written back over the other person's change on the next save.
    if (fresh.title !== refused.title && title.trim() === refused.title) setTitle(fresh.title);
    if (fresh.category !== refused.category && category === refused.category) setCategory(fresh.category);
    if (fresh.reminder !== refused.reminder && reminder === refused.reminder) setReminder(fresh.reminder);
    const days = JSON.stringify([...reminderDays].sort((x, y) => y - x));
    if (JSON.stringify(fresh.reminderDays) !== JSON.stringify(refused.reminderDays) && days === JSON.stringify(refused.reminderDays)) {
      setReminderDays(fresh.reminderDays);
    }
    setBaseline(fresh);
    setRefused(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused, freshKey]);

  // Unticking the last day is the same as switching reminders off, and
  // switching back on starts from the defaults, so the two never disagree.
  function toggleReminderDay(day: number) {
    const next = reminderDays.includes(day)
      ? reminderDays.filter((d) => d !== day)
      : [...reminderDays, day].sort((a, b) => b - a);
    setReminderDays(next);
    if (next.length === 0) setReminder(false);
  }

  function toggleReminder() {
    const on = !reminder;
    setReminder(on);
    if (on && reminderDays.length === 0) setReminderDays([3, 0]);
  }

  const amountNum = Number(amount) || 0;
  const perPerson = members.length > 0 ? amountNum / members.length : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountNum <= 0) return setError("Enter an amount greater than zero.");
    // A bill nobody pays can't be requested or sent: a real pick is required
    // (this is also how a bill whose payer left gets a new one).
    if (!members.some((m) => m.user_id === paidBy)) return setError("Pick who pays this bill.");

    setLoading(true);
    try {
      const dueDay =
        preset && nextDue === preset.nextDue
          ? preset.dueDay
          : nextDue
            ? new Date(`${nextDue}T00:00:00`).getDate()
            : null;

      // Edit mode: update the bill template in place. Already-logged expense
      // instances keep their own amounts/splits; only future cycles use the new
      // values.
      if (edit && baseline) {
        // Only what the user actually changed is written, so a form left open
        // can't undo someone else's edit. The fields that decide what people
        // are billed (amount, schedule, payer) are also compare-and-swapped
        // against what the form was opened with: the bill engine moves the
        // due date on by itself, and writing over that could bill a period
        // twice, undo a rent change, or quietly reassign the payer (which
        // also clears the portions).
        const b = baseline;
        const changes: Record<string, unknown> = {};
        if (title.trim() !== b.title) changes.title = title.trim();
        if (category !== b.category) changes.category = category;
        if (reminder !== b.reminder) changes.reminder_enabled = reminder;
        const days = [...reminderDays].sort((x, y) => y - x);
        if (JSON.stringify(days) !== JSON.stringify(b.reminderDays)) changes.reminder_days = days;
        const amountChanged = Math.round(amountNum * 100) !== Math.round(b.amount * 100);
        if (amountChanged) changes.amount = amountNum;
        const dateChanged = nextDue !== b.nextDue;
        const freqChanged = frequency !== b.frequency;
        if (freqChanged) changes.frequency = frequency;
        if (dateChanged) {
          changes.next_due_date = nextDue || null;
          changes.due_day = nextDue ? dayOf(nextDue) : null;
        } else if (freqChanged && nextDue) {
          // Same date, new frequency: keep the anchor if it still explains
          // the date (a clamped "31st" shown as 30 Sept), else re-anchor on it.
          const explains = b.dueDay != null && Math.min(b.dueDay, daysInMonthOf(nextDue)) === dayOf(nextDue);
          if (!explains) changes.due_day = dayOf(nextDue);
        }
        const payerChanged = paidBy !== b.paidBy;
        if (payerChanged) changes.paid_by = paidBy;

        if (Object.keys(changes).length === 0) {
          router.push("/bills");
          return;
        }

        let q = supabase.from("recurring_bills").update(changes).eq("id", edit.billId);
        if (amountChanged) q = q.eq("amount", b.amount);
        if (dateChanged || freqChanged) {
          q = b.nextDue ? q.eq("next_due_date", b.nextDue) : q.is("next_due_date", null);
          q = q.eq("frequency", b.frequency);
        }
        if (payerChanged) {
          q = b.storedPaidBy ? q.eq("paid_by", b.storedPaidBy) : q.is("paid_by", null);
        }
        const { data: updated, error: updErr } = await q.select("id");
        if (updErr) throw updErr;
        if (!updated || updated.length === 0) {
          // Moved on under the form (usually a cycle just went out). Nothing
          // was written; the fresh values are taken in when the refresh lands
          // (effect above), and the user looks again before saving.
          setError(
            "This bill changed while you were editing (a cycle may have just gone out). Check the amount, next due date and who pays it, then save again.",
          );
          setRefused(b);
          setLoading(false);
          router.refresh();
          return;
        }

        await supabase.from("activity").insert({
          house_id: houseId,
          user_id: currentUserId,
          type: "bill_edited",
          message: `edited the bill “${title.trim()}”`,
        });

        router.push("/bills");
        router.refresh();
        return;
      }

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
        reminder_days: reminderDays,
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
            autoFocus={!preset}
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
                autoFocus={Boolean(preset)}
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="frequency">
              Frequency
            </label>
            <Select
              id="frequency"
              ariaLabel="Frequency"
              value={frequency}
              onChange={(v) => {
                const f = v as BillFrequency;
                setFrequency(f);
                // New bills start a sensible date for the frequency. An edit
                // keeps its date: resetting it could silently skip a cycle
                // that's due in a few days.
                if (!edit) setNextDue(defaultNextDue(f));
              }}
              options={BILL_FREQUENCIES.map((f) => ({ value: f.value, label: f.label }))}
            />
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
            {edit && baseline && edit.nextDue !== baseline.nextDue ? (
              <p className="mt-1 text-[11px] leading-snug text-amber-600">
                This bill moved on to{" "}
                {edit.nextDue ? formatDate(edit.nextDue, { day: "numeric", month: "short" }) : "no date"}{" "}
                while you were editing.
              </p>
            ) : edit?.pendingDue ? (
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                The {formatDate(edit.pendingDue, { day: "numeric", month: "short" })} one has already
                gone out. This is the next one.
              </p>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="paidby">
              Usually paid by
            </label>
            <Select
              id="paidby"
              ariaLabel="Usually paid by"
              value={paidBy}
              onChange={setPaidBy}
              placeholder="Who pays?"
              options={members.map((m) => ({
                value: m.user_id,
                label: m.user_id === currentUserId ? "You" : m.profile?.name ?? "Housemate",
              }))}
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

      <div className="card space-y-3 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-slate-800">Reminders</p>
            <p className="text-xs text-slate-500">Phone notifications, on your schedule.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={reminder}
            onClick={toggleReminder}
            className={`relative h-6 w-11 rounded-full transition ${reminder ? "bg-brand-600" : "bg-slate-300 dark:bg-[#3a3a5e]"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-[#fdfdff] transition ${reminder ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </div>
        {reminder && (
          <div>
            <p className="label">When should everyone hear about it?</p>
            <div className="flex flex-wrap gap-2">
              {REMINDER_DAY_OPTIONS.map((opt) => {
                const on = reminderDays.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleReminderDay(opt.value)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                      on
                        ? "border-brand-300 bg-brand-50 text-brand-700"
                        : "border-slate-200 bg-white text-slate-500 hover:text-slate-700 dark:border-white/10 dark:bg-transparent"
                    }`}
                  >
                    {on ? "✓ " : ""}
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              With portions given out, the first one sends everyone their share and the later ones
              only chase whoever hasn&apos;t paid. Without portions, they remind whoever pays it.
            </p>
          </div>
        )}
      </div>

      {amountNum > 0 && members.length > 0 && (
        <p className="px-1 text-center text-xs text-slate-500">
          Split equally, that&apos;s {formatMoney(perPerson, currency)} each across {members.length}{" "}
          {members.length === 1 ? "person" : "people"}.
        </p>
      )}

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={loading} className="btn-primary btn-block">
        {loading ? "Saving…" : edit ? "Save changes" : "Add recurring bill"}
      </button>
    </form>
  );
}
