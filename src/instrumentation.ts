// Next.js instrumentation. onRequestError fires for uncaught errors in server
// components, route handlers and middleware — we funnel them into error_logs
// (and an admin email alert). Dynamic import keeps the logger out of the edge
// bundle until it's actually needed.

export async function register() {
  /* no startup work needed */
}

type RequestErrorContext = {
  request: { path?: string; method?: string; headers?: Record<string, string | undefined> };
};

export async function onRequestError(
  err: unknown,
  request: RequestErrorContext["request"],
): Promise<void> {
  try {
    const { logError } = await import("@/lib/errorLog");
    const e = err as { message?: string; stack?: string; digest?: string };
    await logError({
      source: "server",
      message: e?.message ?? String(err),
      stack: e?.stack ?? null,
      url: request?.path ?? null,
      userAgent: request?.headers?.["user-agent"] ?? null,
      digest: e?.digest ?? null,
    });
  } catch {
    /* swallow — instrumentation must never throw */
  }
}
