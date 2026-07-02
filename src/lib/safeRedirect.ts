// Guards post-auth redirects against open-redirect abuse. The `next` param is
// attacker-controllable (it rides through /login and the OAuth flow), so it must
// only ever be an in-app, same-origin PATH. Anything that could change the
// destination origin is rejected and falls back to a safe default.
//
// Blocked vectors, all of which would otherwise escape once concatenated onto
// the site origin (e.g. `${origin}${next}`):
//   - absolute URLs:            https://evil.com
//   - userinfo host swap:       @evil.com  -> https://housesync.co.uk@evil.com
//   - protocol-relative:        //evil.com
//   - backslash variant:        /\evil.com  (browsers normalise \ to /)
//   - control chars / newlines that browsers may strip during normalisation
export function safeNextPath(
  next: string | null | undefined,
  fallback = "/dashboard",
): string {
  if (typeof next !== "string" || next.length === 0) return fallback;
  // Must be an absolute in-app path...
  if (!next.startsWith("/")) return fallback;
  // ...but not a protocol-relative / backslash escape.
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;
  // No control characters, space (0x20), or DEL (0x7f) that could be normalised
  // away to reveal a different target.
  for (let i = 0; i < next.length; i++) {
    const c = next.charCodeAt(i);
    if (c <= 0x20 || c === 0x7f) return fallback;
  }
  return next;
}
