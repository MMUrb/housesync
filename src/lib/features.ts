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
} = {
  smoothSettle: true,
};
