import { describe, expect, it } from "vitest";
import { owedForReminder } from "./remindAmount";
import type { Settlement } from "./types";

const ME = "me";
const SAM = "sam";
const PRIYA = "priya";

const expenses = [
  { id: "e1", paid_by: ME },
  { id: "e2", paid_by: ME },
  { id: "e3", paid_by: SAM },
];
const split = (expense_id: string, user_id: string, amount_owed: number, status = "unpaid") => ({
  expense_id,
  user_id,
  amount_owed,
  status: status as "unpaid" | "paid" | "confirmed",
});

describe("owedForReminder, itemised", () => {
  it("adds up their unpaid shares of what I paid", () => {
    const splits = [split("e1", SAM, 12.25), split("e2", SAM, 12.25), split("e1", ME, 12.25, "confirmed")];
    expect(owedForReminder("itemised", ME, SAM, expenses, splits, [])).toBe(24.5);
  });

  it("leaves out shares marked paid (waiting on my confirm), confirmed ones and other payers", () => {
    const splits = [
      split("e1", SAM, 10, "paid"),
      split("e2", SAM, 10, "confirmed"),
      split("e3", SAM, 10), // Sam's own expense
      split("e1", PRIYA, 10), // Priya's share, not Sam's
    ];
    expect(owedForReminder("itemised", ME, SAM, expenses, splits, [])).toBe(0);
  });

  it("is 0 when the reminder would go to yourself", () => {
    expect(owedForReminder("itemised", ME, ME, expenses, [split("e1", ME, 5)], [])).toBe(0);
  });
});

describe("owedForReminder, simplified", () => {
  it("is the plan's payment from them to me", () => {
    // I paid 30 split three ways: Sam and Priya each owe me 10.
    const e = [{ id: "e1", paid_by: ME }];
    const splits = [split("e1", ME, 10, "confirmed"), split("e1", SAM, 10), split("e1", PRIYA, 10)];
    expect(owedForReminder("simplified", ME, SAM, e, splits, [])).toBe(10);
  });

  it("counts payments already made towards it", () => {
    const e = [{ id: "e1", paid_by: ME }];
    const splits = [split("e1", ME, 10, "confirmed"), split("e1", SAM, 10)];
    const paid: Settlement[] = [
      { id: "s1", house_id: "h", from_user: SAM, to_user: ME, amount: 4, status: "confirmed", absorbed: false, created_at: "", confirmed_at: null },
    ];
    expect(owedForReminder("simplified", ME, SAM, e, splits, paid)).toBe(6);
  });

  it("is 0 when the plan routes nothing from them to me", () => {
    const e = [{ id: "e1", paid_by: SAM }];
    const splits = [split("e1", SAM, 10, "confirmed"), split("e1", ME, 10)];
    expect(owedForReminder("simplified", ME, SAM, e, splits, [])).toBe(0);
  });
});
