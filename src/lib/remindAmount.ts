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

/**
 * What `payer` has marked as paid to `payee` that `payee` hasn't confirmed
 * yet, for the "remind them to confirm" notification:
 * - itemised: the payer's shares marked paid on expenses the payee paid for;
 * - simplified: the payer's pending settle-up payments to the payee.
 */
export function pendingForConfirm(
  mode: "itemised" | "simplified",
  payer: string,
  payee: string,
  expenses: Pick<Expense, "id" | "paid_by">[],
  splits: Pick<ExpenseSplit, "expense_id" | "user_id" | "amount_owed" | "status">[],
  settlements: Pick<Settlement, "from_user" | "to_user" | "amount" | "status" | "absorbed">[],
): number {
  if (payer === payee) return 0;
  let total = 0;
  if (mode === "simplified") {
    for (const p of settlements) {
      if (p.from_user === payer && p.to_user === payee && p.status === "pending" && !p.absorbed) {
        total += Number(p.amount);
      }
    }
  } else {
    const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
    for (const s of splits) {
      if (s.status !== "paid" || s.user_id !== payer) continue;
      if (payerOf.get(s.expense_id) !== payee) continue;
      total += Number(s.amount_owed);
    }
  }
  return Math.round(total * 100) / 100;
}
