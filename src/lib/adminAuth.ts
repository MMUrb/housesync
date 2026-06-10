import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

// Optional second-password gate for /admin. Layered ON TOP of the ADMIN_EMAILS
// allowlist — you must already be the signed-in allowlisted user to unlock it.

export const ADMIN_COOKIE = "hs_admin";
// Long-lived so a trusted device (e.g. the HQ app on your phone) doesn't ask
// for the admin password on every open. Still bound to the signed-in admin
// user and revocable any time via the admin "Lock" button / logout route.
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 90; // 90 days, in seconds

const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
const signingSecret =
  process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** The gate is only enforced once a password hash (and a signing secret) exist. */
export function isAdminGateEnabled(): boolean {
  return Boolean(passwordHash && signingSecret);
}

/** Constant-time check of a password against the stored scrypt hash. */
export function verifyAdminPassword(password: string): boolean {
  const [salt, hash] = passwordHash.split(":");
  if (!salt || !hash) return false;
  let test: Buffer;
  try {
    test = scryptSync(password, salt, 64);
  } catch {
    return false;
  }
  const expected = Buffer.from(hash, "hex");
  return test.length === expected.length && timingSafeEqual(test, expected);
}

/** Create a signed session token bound to the user, valid for ADMIN_SESSION_MAX_AGE. */
export function signAdminSession(userId: string): string {
  const body = `${userId}:${Date.now() + ADMIN_SESSION_MAX_AGE * 1000}`;
  const sig = createHmac("sha256", signingSecret).update(body).digest("hex");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

function verifyToken(token: string, userId: string): boolean {
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  let body: string;
  try {
    body = Buffer.from(b64, "base64url").toString();
  } catch {
    return false;
  }
  const expected = createHmac("sha256", signingSecret).update(body).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;

  const [uid, expStr] = body.split(":");
  const exp = Number(expStr);
  return uid === userId && Number.isFinite(exp) && exp > Date.now();
}

/** True if the current request carries a valid admin-session cookie for this user. */
export async function hasAdminSession(userId: string): Promise<boolean> {
  if (!isAdminGateEnabled()) return true; // gate off → no extra step
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  return token ? verifyToken(token, userId) : false;
}
