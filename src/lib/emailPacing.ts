// Keeps email sends under the provider's rate limit. Pure and dependency-free
// (no server-only) so it can be unit tested; email.ts wires it to the real
// fetch.
//
// Resend allows 10 requests a second per account. The daily reminders cron
// runs several workers at once and each send used to go straight out, so a
// busy morning fired 30+ requests a second and every one over the limit came
// back 429 and was dropped: those people silently got no reminder.

export type Sleep = (ms: number) => Promise<void>;
const realSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * At most one start per `intervalMs`, process-wide. Each caller reserves the
 * next free slot synchronously (JS runs one thing at a time, so two callers
 * can never take the same slot) and then waits for it, so concurrent workers
 * queue up evenly instead of bursting.
 */
export function createPacer(
  intervalMs: number,
  now: () => number = Date.now,
  sleep: Sleep = realSleep,
): () => Promise<void> {
  let nextAt = 0;
  return async () => {
    const t = now();
    const at = Math.max(t, nextAt);
    nextAt = at + intervalMs;
    if (at > t) await sleep(at - t);
  };
}

/**
 * How long to back off after a 429. Honours the provider's own advice
 * (retry-after, then ratelimit-reset, both in seconds), falls back to
 * exponential backoff, caps the wait so one send can't eat the cron's time
 * budget, and adds jitter so workers that were refused together don't all
 * retry on the same millisecond and get refused together again.
 */
export function retryDelayMs(
  headers: Headers,
  attempt: number,
  capMs = 2_000,
  random: () => number = Math.random,
): number {
  let ms = Number.NaN;
  const retryAfter = headers.get("retry-after");
  if (retryAfter) {
    const secs = Number(retryAfter);
    ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(retryAfter) - Date.now();
  }
  if (!(ms > 0)) {
    const reset = Number(headers.get("ratelimit-reset"));
    if (reset > 0) ms = reset * 1000;
  }
  if (!(ms > 0)) ms = 500 * 2 ** attempt;
  return Math.min(capMs, ms) + Math.floor(random() * 250);
}

/**
 * Runs a send through the pacer and retries it when the provider answers 429.
 * Only 429 is retried: it means the request was refused before anything
 * happened, so trying again can never deliver an email twice. Anything else
 * (success or a real error) is handed straight back to the caller.
 */
export async function sendPaced(
  attempt: () => Promise<Response>,
  opts: { slot: () => Promise<void>; sleep?: Sleep; maxRetries?: number; random?: () => number },
): Promise<Response> {
  const sleep = opts.sleep ?? realSleep;
  const maxRetries = opts.maxRetries ?? 3;
  for (let i = 0; ; i++) {
    await opts.slot();
    const res = await attempt();
    if (res.status !== 429 || i >= maxRetries) return res;
    // Drain the refused body so the connection can be reused.
    await res.text().catch(() => "");
    await sleep(retryDelayMs(res.headers, i, undefined, opts.random));
  }
}

/**
 * A one-line error from a provider response: "Resend 429 rate_limit_exceeded"
 * rather than the full JSON boilerplate, so a batch of failures stays
 * readable in the admin error log instead of being clipped after a handful.
 */
export function describeProviderError(provider: string, status: number, body: string): string {
  let name: string | null = null;
  let message: string | null = null;
  try {
    const j = JSON.parse(body) as { name?: unknown; message?: unknown; code?: unknown };
    if (typeof j.name === "string") name = j.name;
    else if (typeof j.code === "string") name = j.code;
    if (typeof j.message === "string") message = j.message;
  } catch {
    /* not JSON: fall through to the raw text */
  }
  if (status === 429) return `${provider} 429 ${name ?? "rate limited"}`;
  const detail = message ?? body;
  const clipped = detail.length > 160 ? `${detail.slice(0, 157)}...` : detail;
  return `${provider} ${status}${name ? ` ${name}` : ""}${clipped ? `: ${clipped}` : ""}`;
}
