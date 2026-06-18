import { describe, it, expect } from "vitest";
import { splitEqually, computeBalances } from "./balances";
import { formatMoney, currencySymbol } from "./format";
import type { Expense, ExpenseSplit } from "./types";

// Minimal factories: these functions only read a few fields, so we don't build
// full rows.
const expense = (id: string, paidBy: string): Expense =>
  ({ id, paid_by: paidBy }) as unknown as Expense;
const split = (
  expenseId: string,
  userId: string,
  amount: number,
  status: ExpenseSplit["status"] = "unpaid",
): ExpenseSplit =>
  ({ expense_id: expenseId, user_id: userId, amount_owed: amount, status }) as unknown as ExpenseSplit;

const sum = (xs: number[]) => Math.round(xs.reduce((a, b) => a + b, 0) * 100) / 100;

describe("splitEqually", () => {
  it("splits evenly when it divides cleanly", () => {
    expect(splitEqually(10, 2)).toEqual([5, 5]);
  });

  it("gives the leftover pennies to the first people", () => {
    expect(splitEqually(10, 3)).toEqual([3.34, 3.33, 3.33]);
    expect(splitEqually(0.1, 3)).toEqual([0.04, 0.03, 0.03]);
  });

  it("always sums back to the original amount, to the penny", () => {
    for (const [amount, count] of [
      [10, 3],
      [100, 7],
      [9.99, 4],
      [0.05, 3],
      [250, 6],
    ] as const) {
      expect(sum(splitEqually(amount, count))).toBe(amount);
    }
  });

  it("keeps every share within a penny of the others", () => {
    const parts = splitEqually(100, 7);
    expect(Math.max(...parts) - Math.min(...parts)).toBeCloseTo(0.01, 10);
  });

  it("handles a single person and guards against zero people", () => {
    expect(splitEqually(12.34, 1)).toEqual([12.34]);
    expect(splitEqually(10, 0)).toEqual([]);
  });
});

describe("computeBalances", () => {
  // A pays £30, split £10 each across A, B and C.
  const expenses = [expense("e1", "A")];
  const splits = [split("e1", "A", 10), split("e1", "B", 10), split("e1", "C", 10)];

  it("ignores the payer's own share; others owe the payer", () => {
    const r = computeBalances(expenses, splits, "A");
    expect(r.totalYouAreOwed).toBe(20);
    expect(r.totalYouOwe).toBe(0);
    expect(r.netByUser).toEqual({ A: 20, B: -10, C: -10 });
  });

  it("shows the debt from a debtor's point of view", () => {
    const r = computeBalances(expenses, splits, "B");
    expect(r.totalYouOwe).toBe(10);
    expect(r.totalYouAreOwed).toBe(0);
    expect(r.pairwise).toEqual([{ userId: "A", amount: 10, direction: "you_owe" }]);
  });

  it("excludes confirmed (already settled) splits", () => {
    const settled = [split("e1", "B", 10, "confirmed"), split("e1", "C", 10, "confirmed")];
    const r = computeBalances(expenses, settled, "A");
    expect(r.totalYouAreOwed).toBe(0);
    expect(r.pairwise).toEqual([]);
  });

  it("nets offsetting debts between two people", () => {
    // A paid e1 (B owes A 10); B paid e2 (A owes B 6). Net: A is owed 4.
    const exp = [expense("e1", "A"), expense("e2", "B")];
    const sp = [split("e1", "B", 10), split("e2", "A", 6)];
    const a = computeBalances(exp, sp, "A");
    expect(a.pairwise).toEqual([{ userId: "B", amount: 4, direction: "owes_you" }]);
    expect(a.totalYouAreOwed).toBe(4);
    expect(a.netByUser).toEqual({ A: 4, B: -4 });
  });
});

describe("formatMoney / currencySymbol", () => {
  it("formats GBP with the pound sign and two decimals", () => {
    expect(formatMoney(12.5, "GBP")).toContain("12.50");
    expect(formatMoney(12.5, "GBP")).toContain("£");
    expect(formatMoney(1000, "GBP")).toContain("1,000.00");
  });

  it("maps known currency symbols", () => {
    expect(currencySymbol("GBP")).toBe("£");
    expect(currencySymbol("EUR")).toBe("€");
    expect(currencySymbol("USD")).toBe("$");
  });
});
