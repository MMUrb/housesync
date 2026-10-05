// Turns an App Store Connect API error into one readable line. Pure (no
// server-only) so it can be unit tested.
//
// Apple answers errors as {"errors":[{"status","code","title","detail"}]}.
// Passed through raw, the useful part (the code) sits past where the admin
// Sync button cuts its message off, which is how an expired agreement
// (05/10/2026) looked like an unexplained failure.

export const APPLE_AGREEMENT_MESSAGE =
  "Apple needs the Account Holder to accept an updated agreement at developer.apple.com/account";

export function describeAppleError(status: number, body: string): string {
  let code = "";
  let title = "";
  try {
    const first = (JSON.parse(body) as { errors?: { code?: unknown; title?: unknown }[] })
      .errors?.[0];
    if (typeof first?.code === "string") code = first.code;
    if (typeof first?.title === "string") title = first.title;
  } catch {
    /* not JSON: fall through to the raw text */
  }
  // Not a code problem and not fixable from here: Apple blocks every API call
  // (and new build uploads) until the agreement is accepted, so say exactly
  // what to do.
  if (code.startsWith("FORBIDDEN.REQUIRED_AGREEMENTS")) return APPLE_AGREEMENT_MESSAGE;
  if (code || title) return `Apple ${status} ${code}${title ? `: ${title}` : ""}`.trim();
  const raw = body.trim();
  return `Apple ${status}${raw ? `: ${raw.length > 120 ? `${raw.slice(0, 117)}...` : raw}` : ""}`;
}
