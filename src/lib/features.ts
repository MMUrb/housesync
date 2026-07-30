// Feature flags. Flip a flag to change behaviour; the alternate code path stays
// in place, so nothing is deleted and changes are instantly reversible.

export const FEATURES: {
  /**
   * Redesigned settle-up rows on the Housemates page: a big colour-coded amount
   * and a prominent full-width "Confirm received" / "Mark as paid" action.
   * Set to false to revert to the original compact layout; both versions live
   * in SettleActions.tsx.
   */
  smoothSettle: boolean;
} = {
  smoothSettle: true,
};
