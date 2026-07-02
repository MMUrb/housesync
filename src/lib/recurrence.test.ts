import { describe, it, expect } from "vitest";
import { advanceDate, defaultNextDue, todayISO } from "./recurrence";

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

  it("rolls overflowing month-ends forward (documents JS Date behaviour)", () => {
    // Feb has no 29th in 2025, so a yearly step from a leap day overflows.
    expect(advanceDate("2024-02-29", "yearly")).toBe("2025-03-01");
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
