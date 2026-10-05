import { describe, expect, it } from "vitest";
import { describeBuild, stampBuild } from "./buildStamp";

describe("build stamps on client error reports", () => {
  it("records both the device's build and the build that received it", () => {
    expect(stampBuild("d49d21c", "d49d21c")).toBe("build:d49d21c@d49d21c");
  });

  it("calls a device current when it matched the live build at the time", () => {
    // The 05/10/2026 case: the phone ran d49d21c while d49d21c was live,
    // even though 2b421d9 is live by the time anyone looks.
    expect(describeBuild("build:d49d21c@d49d21c", "2b421d9")).toBe(
      "d49d21c · the live build at the time",
    );
  });

  it("flags a device that was behind the live build at the time", () => {
    expect(describeBuild("build:a86fb41@d49d21c", "2b421d9")).toBe(
      "a86fb41 · not the live build at the time (d49d21c): usually a stale cached copy",
    );
  });

  it("makes no staleness claim for older device-only stamps", () => {
    expect(describeBuild("build:d49d21c", "2b421d9")).toBe("d49d21c · live now: 2b421d9");
    expect(describeBuild("build:2b421d9", "2b421d9")).toBe("2b421d9 · the live build");
  });

  it("treats local dev builds as matching, and ignores non-build digests", () => {
    expect(describeBuild("build:dev@dev", "dev")).toBe("dev · the live build at the time");
    expect(describeBuild("cron-reminders", "2b421d9")).toBeNull();
    expect(describeBuild(null, "2b421d9")).toBeNull();
  });
});
