import { describe, it, expect } from "vitest";
import { formatDate } from "./format";

// These pin the React #418 fix: the server renders in UTC and the viewer's
// device in its own zone, so any date string that changes with the runtime's
// timezone is a hydration failure waiting to happen.
describe("formatDate is timezone-deterministic", () => {
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
    // Previously "15 Sept" anywhere west of UTC, "16 Sept" here.
    const seen = new Set(ZONES.map((tz) => withTz(tz, () => formatDate("2026-09-16"))));
    expect([...seen]).toEqual(["16 Sept"]);
  });

  it("renders a timestamp the same in every timezone", () => {
    // Previously "16 Sept 2026" on the UTC server, "17 Sept 2026" on a UK phone.
    const opts = { day: "numeric", month: "short", year: "numeric" } as const;
    const seen = new Set(
      ZONES.map((tz) => withTz(tz, () => formatDate("2026-09-16T23:52:00Z", opts))),
    );
    expect(seen.size).toBe(1);
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
