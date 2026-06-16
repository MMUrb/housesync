// Feature flags for things that are fully built but intentionally hidden for
// now. Flip a flag to true to bring the feature back — all the UI, components,
// API routes, helpers and DB columns are still in place, nothing was deleted.

export const FEATURES: {
  /**
   * Phone number capture + SMS reminders (the phone field and "Text (SMS)
   * reminders" toggle in Settings → Your account). Hidden 2026-06-16: SMS
   * isn't shipping soon. Re-enabling is just this flag — PhoneVerification,
   * /api/phone/send-code, /api/phone/verify-code, lib/sms.ts and the
   * account_settings.phone / phone_verified / notify_sms columns are untouched.
   */
  phoneSms: boolean;
} = {
  phoneSms: false,
};
