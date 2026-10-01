import { SUPABASE_URL } from "@/lib/env";

// Content-Security-Policy built per-request with a nonce, so we can drop
// 'unsafe-inline' from script-src (the meaningful XSS hardening). Inline scripts
// must now carry the nonce: Next.js adds it to its own bootstrap/hydration
// scripts automatically (it reads the CSP from the request headers the
// middleware sets), and our one inline theme script reads it from headers().
//
// style-src deliberately keeps 'unsafe-inline': Tailwind and Next inject inline
// styles, nonce-based styles aren't well supported, and styles can't execute
// script — so the XSS win is in script-src, not style-src.
//
// 'unsafe-eval' in development only: Next's Fast Refresh runtime evaluates its
// module code as a string, so without it the dev bundle throws before React
// hydrates and NOTHING on the page responds (forms accept typing, because that
// is plain DOM, but no state updates and no button works). Production keeps the
// strict policy, which is where it matters.
const DEV_EVAL = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";

// Images and data may come from this app's own Supabase project only, not
// any *.supabase.co project (which anyone can create).
const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(SUPABASE_URL).origin;
  } catch {
    return "https://*.supabase.co"; // not configured: the app shows a set-up screen anyway
  }
})();
const SUPABASE_WS = SUPABASE_ORIGIN.replace(/^https:/, "wss:");

export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'${DEV_EVAL}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${SUPABASE_ORIGIN}`,
    "font-src 'self' data:",
    `connect-src 'self' ${SUPABASE_ORIGIN} ${SUPABASE_WS}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
