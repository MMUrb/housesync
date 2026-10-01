import { describe, expect, it } from "vitest";
import { joinPromptDue } from "./joinPrompt";

const now = Date.parse("2026-10-10T12:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString();

describe("joinPromptDue", () => {
  it("waits 3 days after signing up", () => {
    expect(joinPromptDue(daysAgo(0), null, now)).toBe(false);
    expect(joinPromptDue(daysAgo(2.9), null, now)).toBe(false);
    expect(joinPromptDue(daysAgo(3), null, now)).toBe(true);
    expect(joinPromptDue(daysAgo(40), null, now)).toBe(true);
  });

  it("counts from leaving a house when that was later", () => {
    expect(joinPromptDue(daysAgo(200), daysAgo(1), now)).toBe(false);
    expect(joinPromptDue(daysAgo(200), daysAgo(3), now)).toBe(true);
  });

  it("an old departure doesn't shorten the wait for a new account", () => {
    expect(joinPromptDue(daysAgo(1), daysAgo(10), now)).toBe(false);
  });

  it("never shows on a date it can't read", () => {
    expect(joinPromptDue("not a date", null, now)).toBe(false);
    expect(joinPromptDue("", daysAgo(10), now)).toBe(false);
  });
});
