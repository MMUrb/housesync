// Shared, Edge-safe helpers for the pre-launch waitlist gate.
// IMPORTANT: no Node-only imports here — this module is used by middleware,
// which runs on the Edge runtime. Only Web-standard APIs (crypto.subtle,
// TextEncoder, process.env) are allowed.

/** Cookie that marks a visitor as having entered the access code. */
export const GATE_COOKIE = "hs_gate";

/** How long an unlocked visitor stays in (180 days). */
export const GATE_MAX_AGE = 60 * 60 * 24 * 180;

/** The shared early-access code, set in the environment. */
export function getAccessCode(): string {
  return (process.env.WAITLIST_ACCESS_CODE ?? "").trim();
}

/**
 * Whether the waitlist gate is live. Requires BOTH the flag to be exactly
 * "true" AND an access code to be set — so a misconfiguration (flag on, code
 * missing) can never lock everyone out with no way back in.
 *
 * To turn the gate OFF when you launch: set WAITLIST_ENABLED=false (or remove
 * it) in Vercel and redeploy.
 */
export function isWaitlistActive(): boolean {
  return process.env.WAITLIST_ENABLED === "true" && getAccessCode().length > 0;
}

const BYPASS_EXACT = new Set(["/waitlist", "/privacy"]);
const BYPASS_PREFIXES = ["/api/waitlist", "/api/cron"];

/** Paths that stay reachable even while the gate is up. */
export function isGateBypassPath(path: string): boolean {
  if (BYPASS_EXACT.has(path)) return true;
  return BYPASS_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`));
}

/**
 * Deterministic, non-reversible token derived from the access code. Stored in
 * the gate cookie; recomputed in middleware to validate. Works in both Edge
 * (middleware) and Node (route handler) runtimes via the global Web Crypto API.
 *
 * Bumping the version string (v2 -> v3 -> ...) invalidates EVERY existing gate
 * cookie without changing the access code — everyone must re-enter the code,
 * and each re-entry is logged in waitlist_unlocks.
 */
export async function gateToken(): Promise<string> {
  const code = getAccessCode();
  if (!code) return "";
  const bytes = new TextEncoder().encode(`housesync-gate:v2:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Whether a cookie value proves the visitor entered the correct code. */
export async function hasValidGateCookie(value: string | undefined | null): Promise<boolean> {
  if (!value) return false;
  const expected = await gateToken();
  return expected.length > 0 && value === expected;
}
