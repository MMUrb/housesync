import { describe, it, expect } from "vitest";
import { formatDate, formatMonthYear, ukMonthLong } from "./format";

// These pin two React #418 fixes seen live on /expenses from iPhones:
// 1. Timezone: the server (UTC) and the viewer's device must land on the same
//    calendar day for the same value.
// 2. Locale data: month and weekday NAMES must come from our own literal
//    tables, never from Intl, because engines ship different spellings for
//    the same locale (en-GB September is "Sept" on V8 but "Sep" on Apple's
//    engines). The expected strings below are literals on purpose: if any
//    engine's ICU update could change them, the fix would be broken.
describe("formatDate is timezone- and engine-deterministic", () => {
  const withTz = <T,>(tz: string, fn: () => T): T => {
    const prev = process.env.TZ;
    process.env.TZ = tz;
    try {
      return fn();
    } finally {
      process.env.TZ = prev;
    }
  };

  const ZONES = ["UTC", "Europe/London", "America/New_York", "America/Los_Angeles", "Australia/Sydney"];

  it("renders a calendar date the same in every timezone", () => {
    const seen = new Set(ZONES.map((tz) => withTz(tz, () => formatDate("2026-09-16"))));
    expect([...seen]).toEqual(["16 Sept"]);
  });

  it("renders a timestamp the same in every timezone", () => {
    const opts = { day: "numeric", month: "short", year: "numeric" } as const;
    const seen = new Set(
      ZONES.map((tz) => withTz(tz, () => formatDate("2026-09-16T23:52:00Z", opts))),
    );
    expect([...seen]).toEqual(["17 Sept 2026"]);
  });

  it("matches the strings the server has always produced, month names included", () => {
    // September, the only month whose en-GB abbreviation engines disagree on.
    expect(formatDate("2026-09-16")).toBe("16 Sept");
    expect(formatDate("2026-09-16", { day: "numeric", month: "short", year: "numeric" })).toBe(
      "16 Sept 2026",
    );
    // A three-letter month, for the shape everyone agrees on.
    expect(formatDate("2026-03-05")).toBe("5 Mar");
    // Long month.
    expect(formatDate("2026-09-16", { day: "numeric", month: "long", year: "numeric" })).toBe(
      "16 September 2026",
    );
    // All-numeric en-GB shape (search results).
    expect(formatDate("2026-09-06", { day: "2-digit", month: "2-digit", year: "numeric" })).toBe(
      "06/09/2026",
    );
    // Weekday shape (bill details). 16/09/2026 is a Wednesday.
    expect(
      formatDate("2026-09-16", {
        weekday: "short",
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    ).toBe("Wed, 16 Sept 2026");
  });

  it("pins timestamps to house time and calendar dates to UTC", () => {
    // 23:52 UTC is 00:52 next day in London (BST): house time wins.
    expect(formatDate("2026-09-16T23:52:00Z")).toBe("17 Sept");
    // The same instant in winter (GMT) stays on the same day.
    expect(formatDate("2026-01-16T23:52:00Z")).toBe("16 Jan");
    // A bare date never shifts, whatever the runtime's zone.
    expect(formatDate("2026-01-01")).toBe("1 Jan");
    expect(formatDate("2026-12-31")).toBe("31 Dec");
  });

  it("still honours an explicit timeZone", () => {
    expect(formatDate("2026-09-16T23:52:00Z", { day: "numeric", month: "short", timeZone: "UTC" })).toBe(
      "16 Sept",
    );
  });

  it("returns empty for an unparseable value", () => {
    expect(formatDate("not-a-date")).toBe("");
  });
});

describe("formatMonthYear", () => {
  it("builds the month heading by string maths alone", () => {
    expect(formatMonthYear("2026-09")).toBe("September 2026");
    expect(formatMonthYear("2025-01")).toBe("January 2025");
  });

  it("hands back anything that is not a month key", () => {
    expect(formatMonthYear("nonsense")).toBe("nonsense");
  });
});

describe("ukMonthLong", () => {
  it("names the month in house time from the literal table", () => {
    expect(ukMonthLong(new Date("2026-09-16T12:00:00Z"))).toBe("September");
    // 23:30 UTC on 31 Aug is already 1 Sept in London (BST).
    expect(ukMonthLong(new Date("2026-08-31T23:30:00Z"))).toBe("September");
  });
});
