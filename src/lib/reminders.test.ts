import { describe, it, expect } from "vitest";
import { buildReminderMessage } from "./reminders";

describe("buildReminderMessage", () => {
  it("includes the person's name and the formatted amount", () => {
    const msg = buildReminderMessage("Alex", 12.5, "GBP");
    expect(msg).toContain("Alex");
    expect(msg).toContain("£12.50");
  });

  it("uses the right currency symbol", () => {
    expect(buildReminderMessage("Sam", 8, "EUR")).toContain("€8.00");
    expect(buildReminderMessage("Sam", 8, "USD")).toContain("$8.00");
  });

  it("stays friendly and non-empty", () => {
    const msg = buildReminderMessage("Jo", 5, "GBP");
    expect(msg.length).toBeGreaterThan(20);
    expect(msg.toLowerCase()).toContain("reminder");
  });
});
