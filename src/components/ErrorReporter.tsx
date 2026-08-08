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

/**
 * A deploy replaces the hashed JS chunks an already-open page knows about, so
 * its next lazy import 404s or times out. src/app/error.tsx heals this for
 * failures thrown during render, but a chunk that fails inside a promise never
 * reaches the error boundary — it surfaces as an unhandled rejection instead.
 * Reload once (sessionStorage-guarded, shared with error.tsx so the two can't
 * reload in turn) to pick up the new build.
 */
function isChunkError(msg: string, name?: string): boolean {
  return name === "ChunkLoadError" || /loading chunk .+ failed/i.test(msg);
}
function healStaleDeploy(): boolean {
  try {
    if (sessionStorage.getItem("hs_chunk_reload") === "1") return false;
    sessionStorage.setItem("hs_chunk_reload", "1");
  } catch {
    return false; // no storage — don't risk a reload loop
  }
  window.location.reload();
  return true;
}

export function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => {
      if (!e?.message) return;
      if (isChunkError(e.message, e.error?.name) && healStaleDeploy()) return;
      reportClientError(e.message, {
        stack: e.error?.stack ?? null,
        url: window.location.pathname,
      });
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const r = e?.reason as { message?: string; stack?: string; name?: string } | undefined;
      const msg = r?.message ?? String(r ?? "Unhandled promise rejection");
      if (isChunkError(msg, r?.name) && healStaleDeploy()) return;
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
