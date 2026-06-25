// Feature flags. Flip a flag to change behaviour; the alternate code path stays
// in place, so nothing is deleted and changes are instantly reversible.

export const FEATURES: {
  /**
   * Phone number capture + SMS reminders (the phone field and "Text (SMS)
   * reminders" toggle in Settings, Your account). Hidden 2026-06-16: SMS isn't
   * shipping soon. Re-enabling is just this flag; PhoneVerification, the
   * /api/phone/* routes, lib/sms.ts and the account_settings phone columns are
   * untouched.
   */
  phoneSms: boolean;
  /**
   * Redesigned settle-up rows on the Housemates page: a big colour-coded amount
   * and a prominent full-width "Confirm received" / "Mark as paid" action.
   * Set to false to revert to the original compact layout; both versions live
   * in SettleActions.tsx.
   */
  smoothSettle: boolean;
} = {
  phoneSms: false,
  smoothSettle: true,
};
