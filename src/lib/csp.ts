// Content-Security-Policy built per-request with a nonce, so we can drop
// 'unsafe-inline' from script-src (the meaningful XSS hardening). Inline scripts
// must now carry the nonce: Next.js adds it to its own bootstrap/hydration
// scripts automatically (it reads the CSP from the request headers the
// middleware sets), and our one inline theme script reads it from headers().
//
// style-src deliberately keeps 'unsafe-inline': Tailwind and Next inject inline
// styles, nonce-based styles aren't well supported, and styles can't execute
// script — so the XSS win is in script-src, not style-src.
export function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "upgrade-insecure-requests",
  ].join("; ");
}
