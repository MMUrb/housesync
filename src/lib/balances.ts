import type { Expense, ExpenseSplit } from "@/lib/types";

export interface PairBalance {
  userId: string;
  amount: number;
  direction: "you_owe" | "owes_you";
}

export interface BalanceResult {
  /** Total the current user owes others. */
  totalYouOwe: number;
  /** Total others owe the current user. */
  totalYouAreOwed: number;
  /** Net balance with each other person (non-zero only), from the user's view. */
  pairwise: PairBalance[];
  /** Overall net per user across the whole house (+ = they are owed). */
  netByUser: Record<string, number>;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Turn expenses + their splits into who-owes-who balances.
 *
 * Each split row means `user_id` owes `amount_owed` to the expense's payer,
 * unless the user IS the payer or the split is already confirmed/settled.
 */
export function computeBalances(
  expenses: Expense[],
  splits: ExpenseSplit[],
  currentUserId: string,
): BalanceResult {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));

  // debt[creditor][debtor] = amount owed
  const debt: Record<string, Record<string, number>> = {};
  const addDebt = (creditor: string | null, debtor: string, amount: number) => {
    if (!creditor || creditor === debtor || amount <= 0) return;
    (debt[creditor] ??= {})[debtor] = (debt[creditor][debtor] ?? 0) + amount;
  };

  for (const s of splits) {
    if (s.status === "confirmed") continue; // settled & confirmed -> ignore
    const creditor = payerOf.get(s.expense_id) ?? null;
    if (s.user_id === creditor) continue; // payer's own share
    addDebt(creditor, s.user_id, Number(s.amount_owed));
  }

  // Overall net per user across the house.
  const netByUser: Record<string, number> = {};
  for (const creditor of Object.keys(debt)) {
    for (const debtor of Object.keys(debt[creditor])) {
      const amt = debt[creditor][debtor];
      netByUser[creditor] = round2((netByUser[creditor] ?? 0) + amt);
      netByUser[debtor] = round2((netByUser[debtor] ?? 0) - amt);
    }
  }

  // Pairwise balances relative to the current user.
  const others = new Set<string>();
  for (const creditor of Object.keys(debt)) {
    others.add(creditor);
    for (const debtor of Object.keys(debt[creditor])) others.add(debtor);
  }
  others.delete(currentUserId);

  const pairwise: PairBalance[] = [];
  let totalYouOwe = 0;
  let totalYouAreOwed = 0;

  for (const other of others) {
    const youOweThem = debt[other]?.[currentUserId] ?? 0;
    const theyOweYou = debt[currentUserId]?.[other] ?? 0;
    const net = round2(youOweThem - theyOweYou);

    if (net > 0.004) {
      pairwise.push({ userId: other, amount: net, direction: "you_owe" });
      totalYouOwe += net;
    } else if (net < -0.004) {
      pairwise.push({ userId: other, amount: -net, direction: "owes_you" });
      totalYouAreOwed += -net;
    }
  }

  pairwise.sort((a, b) => b.amount - a.amount);

  return {
    totalYouOwe: round2(totalYouOwe),
    totalYouAreOwed: round2(totalYouAreOwed),
    pairwise,
    netByUser,
  };
}

/** Split an amount across N people as evenly as possible (pennies included). */
export function splitEqually(amount: number, count: number): number[] {
  if (count <= 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / count);
  let remainder = cents - base * count;
  const result: number[] = [];
  for (let i = 0; i < count; i++) {
    let share = base;
    if (remainder > 0) {
      share += 1;
      remainder -= 1;
    }
    result.push(round2(share / 100));
  }
  return result;
}
