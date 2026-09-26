import { describe, it, expect } from "vitest";
import { advanceDate, defaultNextDue, nextDueForDay, todayISO } from "./recurrence";

describe("advanceDate", () => {
  it("advances weekly and fortnightly by 7 / 14 days", () => {
    expect(advanceDate("2026-01-01", "weekly")).toBe("2026-01-08");
    expect(advanceDate("2026-01-01", "fortnightly")).toBe("2026-01-15");
  });

  it("advances monthly, including across a year boundary", () => {
    expect(advanceDate("2026-01-15", "monthly")).toBe("2026-02-15");
    expect(advanceDate("2026-12-15", "monthly")).toBe("2027-01-15");
  });

  it("advances quarterly and yearly", () => {
    expect(advanceDate("2026-01-15", "quarterly")).toBe("2026-04-15");
    expect(advanceDate("2026-02-28", "yearly")).toBe("2027-02-28");
  });

  it("leaves 'once' and unknown frequencies unchanged", () => {
    expect(advanceDate("2026-03-10", "once")).toBe("2026-03-10");
    expect(advanceDate("2026-03-10", "banana")).toBe("2026-03-10");
  });

  it("is timezone-independent (a calendar date stays that date)", () => {
    // This is the regression guard: with local-time parsing this drifted a day
    // under BST. UTC maths keeps it stable whatever the runner's timezone.
    expect(advanceDate("2026-07-01", "monthly")).toBe("2026-08-01");
    expect(advanceDate("2026-07-15", "weekly")).toBe("2026-07-22");
  });

  it("clamps month-ends to the target month instead of skipping a cycle", () => {
    // 31 Oct + 1 month used to overflow to 1 Dec, losing November's rent.
    expect(advanceDate("2026-10-31", "monthly")).toBe("2026-11-30");
    expect(advanceDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(advanceDate("2026-11-30", "quarterly")).toBe("2027-02-28");
    // Feb has no 29th in 2025, so a yearly step from a leap day clamps.
    expect(advanceDate("2024-02-29", "yearly")).toBe("2025-02-28");
  });

  it("recovers the intended day after a short month via anchorDay", () => {
    // A bill due on the 31st: Oct 31 -> Nov 30 -> Dec 31, not stuck on 30.
    expect(advanceDate("2026-11-30", "monthly", 31)).toBe("2026-12-31");
    expect(advanceDate("2026-02-28", "monthly", 31)).toBe("2026-03-31");
    // Anchor is ignored for day-based frequencies.
    expect(advanceDate("2026-07-15", "weekly", 31)).toBe("2026-07-22");
  });
});

describe("nextDueForDay", () => {
  const from = (iso: string) => new Date(`${iso}T12:00:00Z`);

  it("returns today when the day is today, else the next occurrence", () => {
    expect(nextDueForDay(26, from("2026-09-26"))).toBe("2026-09-26");
    expect(nextDueForDay(1, from("2026-09-26"))).toBe("2026-10-01");
    expect(nextDueForDay(25, from("2026-09-26"))).toBe("2026-10-25");
  });

  it("clamps to short months and rolls over the year end", () => {
    expect(nextDueForDay(31, from("2026-09-26"))).toBe("2026-09-30");
    expect(nextDueForDay(30, from("2026-02-15"))).toBe("2026-02-28");
    expect(nextDueForDay(15, from("2026-12-31"))).toBe("2027-01-15");
  });
});

describe("defaultNextDue / todayISO", () => {
  it("returns a valid yyyy-mm-dd string in the future for a recurring bill", () => {
    const next = defaultNextDue("monthly");
    expect(next).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(next > todayISO()).toBe(true);
  });

  it("todayISO is a well-formed date string", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
