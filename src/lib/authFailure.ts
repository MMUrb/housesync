// Which failed sign-in, sign-up or password-reset attempts are worth the
// admin's attention. Pure, so the rule is tested once and shared by the
// login, forgot-password and reset-password forms.
//
// Report a server or database fault: it means people can't get in, and only
// we can fix it (e.g. "Error sending recovery email", a 500). Never report the
// person's own mistakes or deliberate no's (wrong password, already
// registered, weak or reused password, an expired reset link, a rate limit),
// nor a dropped connection (status 0), which the person can simply retry.
export function isUnexpectedAuthFailure(err: unknown): boolean {
  const status = (err as { status?: unknown } | null)?.status;
  if (typeof status === "number" && status >= 500) return true;
  const msg = err instanceof Error ? err.message : "";
  return /database error|unexpected|relation|not-null|violates/i.test(msg);
}
