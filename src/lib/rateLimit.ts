import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit backed by Postgres (works on stateless serverless,
 * unlike in-memory counters). Returns true when the request is ALLOWED, false
 * when the caller has exceeded `max` hits within `windowSeconds`.
 *
 * Fails OPEN (allows) when the service role isn't configured or the check
 * errors — a rate-limiter outage must never lock real users out.
 */
export async function rateLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!isAdminConfigured) return true;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return true; // fail open
    return data !== false;
  } catch {
    return true; // fail open
  }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
