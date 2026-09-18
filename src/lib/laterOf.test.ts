import { describe, it, expect } from "vitest";
import { laterOf } from "./format";

describe("laterOf", () => {
  it("picks the newer of two timestamps", () => {
    expect(laterOf("2026-09-01T10:00:00Z", "2026-09-18T03:22:00Z")).toBe("2026-09-18T03:22:00Z");
    expect(laterOf("2026-09-18T03:22:00Z", "2026-09-01T10:00:00Z")).toBe("2026-09-18T03:22:00Z");
  });

  it("tolerates either side being missing", () => {
    expect(laterOf(null, "2026-09-01T10:00:00Z")).toBe("2026-09-01T10:00:00Z");
    expect(laterOf("2026-09-01T10:00:00Z", undefined)).toBe("2026-09-01T10:00:00Z");
    expect(laterOf(null, null)).toBeNull();
  });

  it("never moves a timestamp earlier, so last-seen can only improve", () => {
    const signIn = "2026-09-04T10:18:00Z";
    const activity = "2026-09-17T19:40:00Z";
    expect(laterOf(activity, signIn)).toBe(activity);
    // With no activity at all, the sign-in still stands.
    expect(laterOf(undefined, signIn)).toBe(signIn);
  });
});
