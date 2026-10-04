import { buildPlan, netCents } from "@/lib/settle";
import type { Expense, ExpenseSplit, Settlement } from "@/lib/types";

/**
 * What `debtor` owes `creditor` right now, worked out on the server for the
 * reminder notification, so the amount in it can't be typed in by the sender.
 * The same numbers the House tab shows on the Remind row:
 * - itemised: the debtor's unpaid shares of expenses the creditor paid
 *   (shares already marked paid are waiting on a confirm, not a reminder);
 * - simplified: the fewest-payments plan's transfer from debtor to creditor.
 */
export function owedForReminder(
  mode: "itemised" | "simplified",
  creditor: string,
  debtor: string,
  expenses: Pick<Expense, "id" | "paid_by">[],
  splits: Pick<ExpenseSplit, "expense_id" | "user_id" | "amount_owed" | "status">[],
  settlements: Settlement[],
): number {
  if (creditor === debtor) return 0;
  if (mode === "simplified") {
    const plan = buildPlan(netCents(expenses as Expense[], splits as ExpenseSplit[], settlements));
    return plan.find((t) => t.from === debtor && t.to === creditor)?.amount ?? 0;
  }
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  let owed = 0;
  for (const s of splits) {
    if (s.status !== "unpaid" || s.user_id !== debtor) continue;
    if (payerOf.get(s.expense_id) !== creditor) continue;
    owed += Number(s.amount_owed);
  }
  return Math.round(owed * 100) / 100;
}
