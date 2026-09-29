import { describe, it, expect } from "vitest";
import { portionAmounts, portionsValid } from "./billPortions";

const members = ["a", "b", "c"];

describe("portionsValid", () => {
  it("accepts a full percent set and a full amount set", () => {
    expect(
      portionsValid(
        [
          { user_id: "a", share_type: "percent", value: 40 },
          { user_id: "b", share_type: "percent", value: 30 },
          { user_id: "c", share_type: "percent", value: 30 },
        ],
        950,
        members,
      ),
    ).toBe(true);
    expect(
      portionsValid(
        [
          { user_id: "a", share_type: "amount", value: 316.66 },
          { user_id: "b", share_type: "amount", value: 316.67 },
          { user_id: "c", share_type: "amount", value: 316.67 },
        ],
        950,
        members,
      ),
    ).toBe(true);
  });

  it("rejects empty, short-of-total, mixed-mode and departed-member sets", () => {
    expect(portionsValid([], 950, members)).toBe(false);
    expect(
      portionsValid([{ user_id: "a", share_type: "percent", value: 99 }], 950, members),
    ).toBe(false);
    expect(
      portionsValid(
        [
          { user_id: "a", share_type: "percent", value: 50 },
          { user_id: "b", share_type: "amount", value: 475 },
        ],
        950,
        members,
      ),
    ).toBe(false);
    expect(
      portionsValid(
        [
          { user_id: "a", share_type: "percent", value: 50 },
          { user_id: "left", share_type: "percent", value: 50 },
        ],
        950,
        members,
      ),
    ).toBe(false);
  });

  it("survives float noise in amount sets (0.1 + 0.2 style)", () => {
    expect(
      portionsValid(
        [
          { user_id: "a", share_type: "amount", value: 0.1 },
          { user_id: "b", share_type: "amount", value: 0.2 },
        ],
        0.3,
        members,
      ),
    ).toBe(true);
  });
});

describe("portionAmounts", () => {
  it("splits percents to exact pence with the remainder on the payer", () => {
    const rows = portionAmounts(
      [
        { user_id: "a", share_type: "percent", value: 33.33 },
        { user_id: "b", share_type: "percent", value: 33.33 },
        { user_id: "c", share_type: "percent", value: 33.34 },
      ],
      100,
      "a",
    );
    const total = rows.reduce((s, r) => s + r.amount, 0);
    expect(Math.round(total * 100)).toBe(100_00);
  });

  it("lands drift on the largest portion when the payer holds none", () => {
    const rows = portionAmounts(
      [
        { user_id: "a", share_type: "percent", value: 0 },
        { user_id: "b", share_type: "percent", value: 100 },
      ],
      950,
      "a",
    );
    expect(rows.find((r) => r.user_id === "a")?.amount).toBe(0);
    expect(rows.find((r) => r.user_id === "b")?.amount).toBe(950);
  });

  it("passes amount portions through exactly", () => {
    const rows = portionAmounts(
      [
        { user_id: "a", share_type: "amount", value: 380 },
        { user_id: "b", share_type: "amount", value: 285 },
        { user_id: "c", share_type: "amount", value: 285 },
      ],
      950,
      "a",
    );
    expect(rows.map((r) => r.amount)).toEqual([380, 285, 285]);
  });
});
