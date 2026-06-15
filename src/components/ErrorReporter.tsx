"use client";

import { useEffect } from "react";

// Lightweight client error capture. Dedupes by message and caps per session so
// a loop can't flood the log, then posts to /api/log-error. Also exported as a
// function so critical flows (e.g. signup) can report a notable caught error.

let reportedCount = 0;
const seen = new Set<string>();

export function reportClientError(
  message: string,
  extra?: { stack?: string | null; url?: string | null },
): void {
  if (!message || typeof window === "undefined") return;
  const key = message.slice(0, 120);
  if (seen.has(key) || reportedCount >= 25) return;
  seen.add(key);
  reportedCount += 1;
  try {
    void fetch("/api/log-error", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        message: message.slice(0, 2000),
        stack: extra?.stack ?? null,
        url: extra?.url ?? window.location.pathname,
      }),
    });
  } catch {
    /* best-effort */
  }
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (!e?.message) return;
      reportClientError(e.message, {
        stack: e.error?.stack ?? null,
        url: window.location.pathname,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason as { message?: string; stack?: string } | undefined;
      const msg = r?.message ?? String(r ?? "Unhandled promise rejection");
      reportClientError(`Unhandled rejection: ${msg}`, {
        stack: r?.stack ?? null,
        url: window.location.pathname,
      });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);
  return null;
}
