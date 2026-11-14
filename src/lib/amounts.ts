// The largest amount the database can hold. Every money column people type
// into is numeric(12, 2): expenses, recurring bills, bill portions, splits
// and the monthly budget. From 10,000,000,000 up, the database refuses the
// save with a bare "numeric field overflow", which is what the person adding
// an expense saw on 03/11 and 06/11/2026 (almost certainly extra digits or a
// pasted number).
// The forms check this first and say it plainly. It's the database's own
// limit rather than a smaller "sensible" one on purpose: houses can use
// currencies where everyday amounts run to millions.
export const MAX_AMOUNT = 9_999_999_999.99;

export const AMOUNT_TOO_LARGE = "That amount is too big. Check for extra digits.";

export function isAmountTooLarge(n: number): boolean {
  return !Number.isFinite(n) || n > MAX_AMOUNT;
}
