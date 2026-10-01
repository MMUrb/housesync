import "server-only";

// Who may open /admin. ADMIN_USER_IDS (comma-separated Supabase user ids) is
// the one to use: an id can't be claimed by anyone else. ADMIN_EMAILS is the
// older list and is only consulted while ADMIN_USER_IDS is unset: sign-up
// doesn't confirm emails, so an allowlisted address that hasn't registered
// yet could be registered by someone else.
// Set them in your environment (Vercel + .env.local), e.g.
// ADMIN_USER_IDS="6f1c...-..." and ADMIN_EMAILS="you@housesync.co.uk".
const parse = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
const adminIds = parse(process.env.ADMIN_USER_IDS);
const adminEmails = parse(process.env.ADMIN_EMAILS);

/** Whether this signed-in user is an admin. */
export function isAdminUser(user: { id: string; email?: string | null }): boolean {
  if (adminIds.length > 0) return adminIds.includes(user.id.toLowerCase());
  return Boolean(user.email) && adminEmails.includes(user.email!.toLowerCase());
}

/** True once at least one admin has been configured. */
export const hasAdminAllowlist = adminIds.length > 0 || adminEmails.length > 0;
