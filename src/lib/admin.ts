import "server-only";

// Comma-separated allowlist of emails that may access /admin.
// Set ADMIN_EMAILS in your environment (Vercel + .env.local), e.g.
// ADMIN_EMAILS="you@housesync.co.uk".
const admins = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Whether the given email is on the admin allowlist. */
export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return admins.includes(email.toLowerCase());
}

/** True once at least one admin email has been configured. */
export const hasAdminAllowlist = admins.length > 0;
