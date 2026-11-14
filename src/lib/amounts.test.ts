import { describe, expect, it } from "vitest";
import { MAX_AMOUNT, isAmountTooLarge } from "./amounts";

describe("isAmountTooLarge", () => {
  it("lets through anything the numeric(12, 2) columns can store", () => {
    expect(isAmountTooLarge(12.5)).toBe(false);
    expect(isAmountTooLarge(1_250_000)).toBe(false); // e.g. a rent in a high-denomination currency
    expect(isAmountTooLarge(MAX_AMOUNT)).toBe(false);
  });

  it("stops what the database would refuse with 'numeric field overflow'", () => {
    expect(isAmountTooLarge(10_000_000_000)).toBe(true);
    expect(isAmountTooLarge(Number("123456789012"))).toBe(true); // extra digits / a pasted number
    expect(isAmountTooLarge(Number("1e12"))).toBe(true);
    expect(isAmountTooLarge(Infinity)).toBe(true);
  });
});
