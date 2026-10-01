import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

/**
 * Fixed-window rate limit backed by Postgres (works on stateless serverless,
 * unlike in-memory counters). Returns true when the request is ALLOWED, false
 * when the caller has exceeded `max` hits within `windowSeconds`.
 *
 * Fails OPEN (allows) when the service role isn't configured or the check
 * errors — a rate-limiter outage must never lock real users out. failClosed
 * flips that for gates where a guess must never get through unlimited (the
 * admin password): an outage then refuses instead.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowSeconds: number,
  { failClosed = false }: { failClosed?: boolean } = {},
): Promise<boolean> {
  if (!isAdminConfigured) return !failClosed;
  try {
    const admin = createAdminClient();
    const { data, error } = await admin.rpc("rate_limit_hit", {
      p_key: key,
      p_max: max,
      p_window_seconds: windowSeconds,
    });
    if (error) return !failClosed;
    return data !== false;
  } catch {
    return !failClosed;
  }
}

export { clientIp } from "@/lib/clientIp";
