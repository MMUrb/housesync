"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { showToast } from "@/components/app/Toast";
import { formatDate, formatMoney, currencySymbol } from "@/lib/format";
import { splitEqually } from "@/lib/balances";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";
import { EDITOR_KEEP_OVERDUE_DAYS, overdueOnSave } from "@/lib/billEngine";
import type { BillSplit } from "@/lib/types";

type Member = { id: string; name: string; color: string | null; avatarUrl: string | null };
type Mode = "amount" | "percent";

/** set_bill_portions guard codes, said in plain words. */
function portionsErrorMessage(message: string): string {
  if (message.includes("portions_payer_only")) {
    return "Only the person who pays this bill can give out its portions.";
  }
  if (message.includes("portions_not_member")) {
    return "Someone in this list has left the house. Refresh and try again.";
  }
  if (message.includes("portions_dont_add_up") || message.includes("portions_negative")) {
    return "The portions don't add up. Check the numbers and try again.";
  }
  if (/schema cache|does not exist/i.test(message)) {
    return "Saving portions needs the app's latest update, which is still rolling out. Try again in a minute.";
  }
  return message;
}

/** "21 Sept", or "21 Sept 2027" when it isn't this year (yearly bills). */
const dateWords = (iso: string, today: string) =>
  formatDate(
    iso,
    iso.slice(0, 4) === today.slice(0, 4)
      ? { day: "numeric", month: "short" }
      : { day: "numeric", month: "short", year: "numeric" },
  );

/**
 * "Give out the portions": the payer's editor for a bill's stored per-person
 * shares, in pounds or percent. Once a valid set is saved the bill runs
 * itself (the cron sends everyone their own number each cycle); clearing the
 * portions puts the bill back on the manual request flow. Saves go through
 * set_bill_portions, one validated transaction, so a failure never leaves a
 * half-set behind, and only the payer can save (checked in the database).
 */
export function PortionsEditor({
  billId,
  billTitle,
  amount,
  currency,
  houseId,
  members,
  currentUserId,
  initialSplits,
  initialOpen = false,
  frequency,
  nextDue,
  dueDay,
  today,
  autoSends = true,
}: {
  billId: string;
  billTitle: string;
  amount: number;
  currency: string;
  houseId: string;
  members: Member[];
  currentUserId: string;
  initialSplits: BillSplit[];
  initialOpen?: boolean;
  frequency: string;
  nextDue: string | null;
  dueDay: number | null;
  /** Today's date from the server (yyyy-mm-dd), so render stays hydration-safe. */
  today: string;
  /** Whether the bill engine sends portioned cycles for this house (FEATURES.autoPortions). */
  autoSends?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();
  const hasPortions = initialSplits.length > 0;

  const [open, setOpen] = useState(initialOpen);
  const [mode, setMode] = useState<Mode>(initialSplits[0]?.share_type ?? "percent");
  const [values, setValues] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const s of initialSplits) map[s.user_id] = String(s.value);
    return map;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Arrived via ?portions=<id> (the join sheet's button): open once, then
  // drop the query so a refresh, reload or Back never reopens it.
  useEffect(() => {
    if (initialOpen) router.replace(pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(() => setOpen(false));
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
    };
  }, [open]);

  const cents = (v: string | undefined) => Math.round((Number(v) || 0) * 100);
  const totalPence = Math.round(amount * 100);
  const targetFor = (m: Mode) => (m === "percent" ? 100_00 : totalPence);
  const sumFor = (vals: Record<string, string>) =>
    members.reduce((sum, m) => sum + cents(vals[m.id]), 0);
  const totalCents = sumFor(values);
  const allNonNegative = members.every((m) => cents(values[m.id]) >= 0);
  const valid = members.length > 0 && allNonNegative && totalCents === targetFor(mode);

  // Only matters when the engine will actually send: with automatic billing
  // off the payer requests by hand, so an overdue date is theirs to handle.
  const overdue = autoSends
    ? overdueOnSave(nextDue, frequency, dueDay ?? undefined, today)
    : ({ kind: "none" } as const);
  const shortDate = (iso: string) => dateWords(iso, today);

  const asOther = (v: string | undefined) => {
    const n = cents(v);
    return mode === "percent"
      ? formatMoney(Math.round((totalPence * n) / 100_00) / 100, currency)
      : `${totalPence > 0 ? Math.round((n / totalPence) * 1000) / 10 : 0}%`;
  };

  function fillEqually() {
    setError(null);
    const map: Record<string, string> = {};
    if (mode === "amount") {
      const parts = splitEqually(amount, members.length);
      members.forEach((m, i) => (map[m.id] = String(parts[i])));
    } else {
      const base = Math.floor(100_00 / members.length);
      let left = 100_00 - base * members.length;
      members.forEach((m) => {
        const extra = left > 0 ? 1 : 0;
        left -= extra;
        map[m.id] = String((base + extra) / 100);
      });
    }
    setValues(map);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setError(null);
    // Convert in whole pence / basis points so nothing drifts; if the old set
    // added up, the rounding remainder goes on the largest row so the new
    // set adds up too (a valid set never turns invalid just by flipping).
    const wasValid = sumFor(values) === targetFor(mode);
    const conv: Record<string, number> = {};
    for (const m of members) {
      const c = cents(values[m.id]);
      conv[m.id] =
        next === "percent"
          ? totalPence > 0
            ? Math.round((c * 100_00) / totalPence)
            : 0
          : Math.round((totalPence * c) / 100_00);
    }
    if (wasValid && members.length > 0) {
      const drift = targetFor(next) - members.reduce((s, m) => s + conv[m.id], 0);
      if (drift !== 0) {
        const largest = members.reduce((a, b) => (conv[a.id] >= conv[b.id] ? a : b));
        conv[largest.id] += drift;
      }
    }
    const map: Record<string, string> = {};
    for (const m of members) {
      map[m.id] = values[m.id] === undefined || values[m.id] === "" ? "" : String(conv[m.id] / 100);
    }
    setMode(next);
    setValues(map);
  }

  async function save() {
    if (!valid || saving) return;
    setError(null);
    setSaving(true);
    try {
      const rows = members
        .filter((m) => cents(values[m.id]) > 0 || m.id === currentUserId)
        .map((m) => ({ user_id: m.id, value: cents(values[m.id]) / 100 }));
      const { data, error: rpcErr } = await supabase.rpc("set_bill_portions", {
        p_bill_id: billId,
        p_share_type: mode,
        p_rows: rows,
        p_expected_due: nextDue,
        p_roll_to: overdue.kind === "skip" ? overdue.rollTo : null,
      });
      if (rpcErr) throw new Error(portionsErrorMessage(rpcErr.message ?? ""));
      const result = data as { status?: string; rolled?: boolean } | null;
      if (result?.status !== "saved") throw new Error("The portions weren't saved. Refresh and try again.");
      const rolled = Boolean(result.rolled);
      // Everyone can see their portion changed, in the house feed.
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "bill_edited",
        message: `gave out the portions of “${billTitle}”`,
      });
      setSaving(false);
      setOpen(false);
      showToast({
        message:
          overdue.kind === "skip" && rolled
            ? `Portions saved. They start with the ${shortDate(overdue.rollTo)} one.`
            : overdue.kind === "sendsLate"
              ? "Portions saved. The overdue one goes out on the next morning run."
              : "Portions saved. They only change when you change them.",
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the portions.");
      setSaving(false);
    }
  }

  async function backToManual() {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const { data, error: rpcErr } = await supabase.rpc("set_bill_portions", {
        p_bill_id: billId,
        p_share_type: mode,
        p_rows: [],
      });
      if (rpcErr) throw new Error(portionsErrorMessage(rpcErr.message ?? ""));
      if ((data as { status?: string } | null)?.status !== "cleared") {
        throw new Error("Nothing changed. Refresh and try again.");
      }
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "bill_edited",
        message: `switched “${billTitle}” back to manual requesting`,
      });
      setSaving(false);
      setOpen(false);
      showToast({ message: "Back to manual requesting for this bill." });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch back.");
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-secondary btn-block mt-3 text-sm"
      >
        {hasPortions ? "Edit portions" : "Give out portions"}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Portions of ${billTitle}`}
        >
          <div
            className="card max-h-[88vh] w-full max-w-md overflow-y-auto rounded-b-none rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-white/15" />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-bold text-slate-900">Give out the portions</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {billTitle}, {formatMoney(amount, currency)}. Your numbers, nothing moves until
                  you save.
                </p>
              </div>
              <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
                {(["amount", "percent"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchMode(m)}
                    className={`rounded-md px-2.5 py-1 transition ${
                      mode === m ? "bg-white text-brand-700 shadow-sm" : "text-slate-500"
                    }`}
                  >
                    {m === "amount" ? currencySymbol(currency) : "%"}
                  </button>
                ))}
              </div>
            </div>

            <ul className="mt-3 space-y-1.5">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3">
                  <Avatar
                    name={m.name}
                    color={m.color ?? undefined}
                    avatarUrl={m.avatarUrl ?? undefined}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                    {m.id === currentUserId ? "You" : m.name}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">{asOther(values[m.id])}</span>
                  <div className="relative w-24 shrink-0">
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      className="input py-1.5 pr-7 text-right text-sm font-semibold"
                      placeholder="0"
                      value={values[m.id] ?? ""}
                      onChange={(e) => setValues((p) => ({ ...p, [m.id]: e.target.value }))}
                    />
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      {mode === "percent" ? "%" : currencySymbol(currency)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-2.5 flex items-center justify-between">
              <span className={`text-xs font-semibold ${valid ? "text-mint-600" : "text-red-500"}`}>
                {!allNonNegative
                  ? "Portions can't be negative"
                  : valid
                    ? mode === "percent"
                      ? "✓ Adds up to 100%"
                      : `✓ Adds up to ${formatMoney(amount, currency)}`
                    : mode === "percent"
                      ? `${totalCents / 100}% of 100%`
                      : `${formatMoney(totalCents / 100, currency)} of ${formatMoney(amount, currency)}`}
              </span>
              <button
                type="button"
                onClick={fillEqually}
                className="text-xs font-semibold text-brand-600 hover:underline"
              >
                Split equally
              </button>
            </div>

            {mode === "percent" && (
              <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
                Percentages stick through rent changes: if the amount changes, everyone&apos;s
                portion moves with it, no re-typing.
              </p>
            )}

            {overdue.kind === "sendsLate" && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                {billTitle} was due {shortDate(overdue.due)} and hasn&apos;t gone out. Saving sends it
                with these portions on the next morning run.
              </p>
            )}
            {overdue.kind === "skip" && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                {billTitle} was due {shortDate(overdue.due)}, more than {EDITOR_KEEP_OVERDUE_DAYS} days
                ago, so it won&apos;t be sent. Portions start with the {shortDate(overdue.rollTo)} one.
                Add the overdue one as an expense if it&apos;s still owed.
              </p>
            )}

            {error && (
              <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="button"
              onClick={() => void save()}
              disabled={!valid || saving}
              className="btn-primary btn-block mt-4 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save portions"}
            </button>
            {hasPortions && (
              <button
                type="button"
                onClick={() => void backToManual()}
                disabled={saving}
                className="mx-auto mt-3 block text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600"
              >
                Switch back to manual requesting
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
