// Stored bill portions: the payer gives them out once (in pounds or percent)
// and each cycle is built from them. All maths in integer pence so a set of
// portions can never drift a penny from the bill total.

import type { BillSplit } from "@/lib/types";

export type PortionRow = Pick<BillSplit, "user_id" | "share_type" | "value">;

/** The reminder-day choices bills offer, earliest first. */
export const REMINDER_DAY_OPTIONS = [
  { value: 7, label: "1 week before" },
  { value: 3, label: "3 days before" },
  { value: 1, label: "1 day before" },
  { value: 0, label: "On the day" },
] as const;

/** The nudge-delay choices expenses offer (days after the expense date). */
export const NUDGE_AFTER_OPTIONS = [
  { value: 3, label: "After 3 days" },
  { value: 7, label: "After a week" },
  { value: 14, label: "After 2 weeks" },
  { value: null, label: "Never" },
] as const;

/**
 * A portion set is usable only when it is complete: one consistent mode,
 * every holder still in the house, and the values covering the bill exactly
 * (100% or the full amount). Anything else pauses the automatic sends and
 * prompts the payer instead of guessing.
 */
export function portionsValid(
  splits: readonly PortionRow[],
  amount: number,
  memberIds: readonly string[],
): boolean {
  if (splits.length === 0) return false;
  const mode = splits[0].share_type;
  if (!splits.every((s) => s.share_type === mode)) return false;
  if (!splits.every((s) => memberIds.includes(s.user_id))) return false;
  const totalCents = splits.reduce((sum, s) => sum + Math.round(Number(s.value) * 100), 0);
  if (mode === "percent") return totalCents === 100_00;
  return totalCents === Math.round(amount * 100);
}

/**
 * Pence-exact per-person amounts for one cycle. Percent portions round per
 * person and the remainder lands on the payer (or the largest portion when
 * the payer holds none), so the rows always sum to the bill amount.
 */
export function portionAmounts(
  splits: readonly PortionRow[],
  amount: number,
  payerId: string | null,
): { user_id: string; amount: number }[] {
  const totalCents = Math.round(amount * 100);
  const mode = splits[0]?.share_type ?? "amount";
  const rows = splits.map((s) => ({
    user_id: s.user_id,
    cents:
      mode === "percent"
        ? Math.round((totalCents * Number(s.value)) / 100)
        : Math.round(Number(s.value) * 100),
  }));
  const drift = totalCents - rows.reduce((sum, r) => sum + r.cents, 0);
  if (drift !== 0 && rows.length > 0) {
    const payerRow = rows.find((r) => r.user_id === payerId && r.cents + drift >= 0);
    const target =
      payerRow ?? rows.slice().sort((a, b) => b.cents - a.cents)[0];
    target.cents += drift;
  }
  return rows.map((r) => ({ user_id: r.user_id, amount: r.cents / 100 }));
}
