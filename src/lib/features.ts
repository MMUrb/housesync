// Feature flags. Flip a flag to change behaviour; the alternate code path stays
// in place, so nothing is deleted and changes are instantly reversible.

export const FEATURES: {
  /**
   * Redesigned settle-up on the Housemates page (itemised mode): one line per
   * person with a single state-matched button (Pay / Remind / Confirm), and a
   * person sheet with the expense breakdown, pay links and an editable amount
   * (part payments via the pay_itemised RPC). Set to false to revert to the
   * original compact layout; both versions live in SettleActions.tsx.
   */
  smoothSettle: boolean;
  /**
   * Bills with portions bill themselves: the daily cron creates each cycle
   * from the payer's portions and tells everyone their own amount.
   * - true: every house.
   * - false: off everywhere (the emergency stop). Portioned bills go back to
   *   the Request button, which still splits by the portions.
   * - a list of house ids: only those houses (a trial run).
   * Portions themselves are untouched either way.
   */
  autoPortions: boolean | readonly string[];
} = {
  smoothSettle: true,
  autoPortions: true,
};

/** Whether the bill engine may create portioned cycles for this house. */
export function autoPortionsFor(houseId: string): boolean {
  const flag = FEATURES.autoPortions;
  return typeof flag === "boolean" ? flag : flag.includes(houseId);
}
