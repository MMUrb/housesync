import type { Expense, ExpenseSplit, Settlement } from "@/lib/types";

// Simplified settle up: turn everyone's net position into the fewest transfers
// that clear the house. All maths here is done in integer pence so repeated
// adds can never drift a float past a comparison.

export interface PlanTransfer {
  from: string;
  to: string;
  amount: number;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Net position per user in pence. Positive = they are owed money. */
export function netCents(
  expenses: Expense[],
  splits: ExpenseSplit[],
  settlements: Settlement[],
): Record<string, number> {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  const nets: Record<string, number> = {};
  const add = (uid: string, cents: number) => {
    nets[uid] = (nets[uid] ?? 0) + cents;
  };

  for (const s of splits) {
    if (s.status === "confirmed") continue; // settled history
    const payer = payerOf.get(s.expense_id);
    if (!payer || s.user_id === payer) continue;
    const cents = Math.round(Number(s.amount_owed) * 100);
    add(payer, cents);
    add(s.user_id, -cents);
  }

  // Pending counts too: money already on its way must not be asked for twice.
  // Absorbed settlements are excluded everywhere: the sweep that set the flag
  // also confirmed the matching splits, so counting both would double-pay.
  for (const s of settlements) {
    if (s.absorbed) continue;
    const cents = Math.round(Number(s.amount) * 100);
    add(s.from_user, cents);
    add(s.to_user, -cents);
  }
  return nets;
}

/**
 * Fewest-payments plan: repeatedly send the biggest debtor's money to the
 * biggest creditor. Deterministic (user-id tiebreak) so every housemate's
 * device computes the identical plan from the same data.
 */
export function buildPlan(nets: Record<string, number>): PlanTransfer[] {
  const debtors = Object.entries(nets)
    .filter(([, c]) => c < 0)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1))
    .map(([id, c]) => ({ id, left: -c }));
  const creditors = Object.entries(nets)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .map(([id, c]) => ({ id, left: c }));

  const plan: PlanTransfer[] = [];
  let d = 0;
  let c = 0;
  while (d < debtors.length && c < creditors.length) {
    const move = Math.min(debtors[d].left, creditors[c].left);
    if (move > 0) {
      plan.push({ from: debtors[d].id, to: creditors[c].id, amount: round2(move / 100) });
    }
    debtors[d].left -= move;
    creditors[c].left -= move;
    if (debtors[d].left === 0) d++;
    if (creditors[c].left === 0) c++;
  }
  return plan;
}

/** How many person-to-person debts the itemised view shows (netted pairs). */
export function countPairwiseDebts(expenses: Expense[], splits: ExpenseSplit[]): number {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  // pair key "a|b" with a < b; value = cents owed from a's perspective.
  const pair: Record<string, number> = {};
  for (const s of splits) {
    if (s.status === "confirmed") continue;
    const payer = payerOf.get(s.expense_id);
    if (!payer || s.user_id === payer) continue;
    const cents = Math.round(Number(s.amount_owed) * 100);
    const [a, b] = s.user_id < payer ? [s.user_id, payer] : [payer, s.user_id];
    const sign = s.user_id === a ? 1 : -1; // a owes b when positive
    pair[`${a}|${b}`] = (pair[`${a}|${b}`] ?? 0) + sign * cents;
  }
  return Object.values(pair).filter((c) => Math.abs(c) > 0).length;
}

/**
 * The house is square when nobody is owed anything and no payment is still
 * waiting on a confirm. This is the only moment split statuses and the
 * settlements ledger can be reconciled without lying to anyone.
 */
export function houseIsSquare(nets: Record<string, number>, settlements: Settlement[]): boolean {
  if (settlements.some((s) => !s.absorbed && s.status === "pending")) return false;
  return Object.values(nets).every((c) => Math.abs(c) <= 1);
}

/** Rows the square-house sweep should touch (both updates are idempotent). */
export function sweepTargets(
  splits: ExpenseSplit[],
  settlements: Settlement[],
): { splitIds: string[]; settlementIds: string[] } {
  return {
    splitIds: splits.filter((s) => s.status !== "confirmed").map((s) => s.id),
    settlementIds: settlements.filter((s) => !s.absorbed).map((s) => s.id),
  };
}
