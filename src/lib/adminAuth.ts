import "server-only";
import { createHmac, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

// Second-password gate for /admin. Layered ON TOP of the admin allowlist
// (src/lib/admin.ts) — you must already be the signed-in allowlisted user to
// unlock it.

export const ADMIN_COOKIE = "hs_admin";
// Two weeks, so a trusted device (e.g. the HQ app on your phone) doesn't ask
// for the admin password on every open. Bound to the signed-in admin AND to
// that sign-in: signing out, or "sign out of all sessions" in Supabase, ends
// it everywhere; the "Lock" button ends it on this device.
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14 days, in seconds

const passwordHash = process.env.ADMIN_PASSWORD_HASH ?? "";
const signingSecret =
  process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Whether a password hash (and a signing secret) exist to run the gate with. */
export function isAdminGateEnabled(): boolean {
  return Boolean(passwordHash && signingSecret);
}

// Only local development may run without the admin password. A deployment
// missing it (a preview, a mistyped or deleted env var) stays locked instead
// of waving every allowlisted user straight in.
export const ADMIN_GATE_REQUIRED = process.env.NODE_ENV === "production";

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

/**
 * The Supabase sign-in this request belongs to: the access token's session_id
 * claim, which survives token refreshes and changes on every new sign-in.
 * Callers have already verified the user with getUser(), so reading the claim
 * from that same session's token is enough.
 */
async function currentSessionId(): Promise<string | null> {
  try {
    const { data } = await (await createClient()).auth.getSession();
    const token = data.session?.access_token;
    if (!token) return null;
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString());
    return typeof payload.session_id === "string" && payload.session_id ? payload.session_id : null;
  } catch {
    return null;
  }
}

/**
 * A signed session token bound to the user and their current sign-in, valid
 * for ADMIN_SESSION_MAX_AGE. null when the sign-in can't be read.
 */
export async function signAdminSession(userId: string): Promise<string | null> {
  const sessionId = await currentSessionId();
  if (!sessionId) return null;
  const body = `${userId}:${sessionId}:${Date.now() + ADMIN_SESSION_MAX_AGE * 1000}`;
  const sig = createHmac("sha256", signingSecret).update(body).digest("hex");
  return `${Buffer.from(body).toString("base64url")}.${sig}`;
}

function verifyToken(token: string, userId: string, sessionId: string): boolean {
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

  const [uid, sid, expStr] = body.split(":");
  const exp = Number(expStr);
  return uid === userId && sid === sessionId && Number.isFinite(exp) && exp > Date.now();
}

/**
 * True if the current request carries a valid admin-session cookie for this
 * user and this sign-in.
 */
export async function hasAdminSession(userId: string): Promise<boolean> {
  if (!isAdminGateEnabled()) return !ADMIN_GATE_REQUIRED; // dev only: no extra step
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;
  const sessionId = await currentSessionId();
  return sessionId ? verifyToken(token, userId, sessionId) : false;
}
