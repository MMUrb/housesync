"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type State = "working" | "unsubscribed" | "resubscribed" | "invalid" | "failed";

// Unsubscribes on arrival, from the browser rather than the server render, so
// mail scanners that pre-open links (and don't run scripts) can't unsubscribe
// anyone by accident. Undo puts it straight back.
export function UnsubscribeCard({ u, t }: { u: string; t: string }) {
  const [state, setState] = useState<State>(u && t ? "working" : "invalid");
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function post(undo: boolean): Promise<State> {
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ u, t, undo }),
      });
      if (res.status === 400) return "invalid";
      if (!res.ok) return "failed";
      return undo ? "resubscribed" : "unsubscribed";
    } catch {
      return "failed";
    }
  }

  useEffect(() => {
    if (started.current || !u || !t) return;
    started.current = true;
    void post(false).then(setState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function toggle(undo: boolean) {
    setBusy(true);
    setState(await post(undo));
    setBusy(false);
  }

  return (
    <div className="card mt-8 p-7 text-center">
      {state === "working" && <p className="text-sm text-slate-500">One moment…</p>}

      {state === "unsubscribed" && (
        <>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600">
            ✓
          </div>
          <h1 className="text-xl font-bold text-slate-900">You&rsquo;re unsubscribed</h1>
          <p className="mt-2 text-sm text-slate-600">
            You won&rsquo;t get <b>news</b> emails from HouseSync any more. Bill reminders and
            anything else you&rsquo;ve switched on aren&rsquo;t affected.
          </p>
          <button
            type="button"
            onClick={() => void toggle(true)}
            disabled={busy}
            className="btn-secondary btn-block mt-5"
          >
            Undo, keep sending them
          </button>
        </>
      )}

      {state === "resubscribed" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">You&rsquo;re subscribed again</h1>
          <p className="mt-2 text-sm text-slate-600">News from HouseSync is back on.</p>
          <button
            type="button"
            onClick={() => void toggle(false)}
            disabled={busy}
            className="btn-secondary btn-block mt-5"
          >
            Unsubscribe after all
          </button>
        </>
      )}

      {state === "invalid" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">This link doesn&rsquo;t work</h1>
          <p className="mt-2 text-sm text-slate-600">
            It may be incomplete. You can turn news emails off in Settings → Notifications.
          </p>
        </>
      )}

      {state === "failed" && (
        <>
          <h1 className="text-xl font-bold text-slate-900">That didn&rsquo;t go through</h1>
          <p className="mt-2 text-sm text-slate-600">Check your connection and try again.</p>
          <button
            type="button"
            onClick={() => void toggle(false)}
            disabled={busy}
            className="btn-secondary btn-block mt-5"
          >
            Try again
          </button>
        </>
      )}

      {state !== "working" && (
        <Link href="/settings" className="btn-primary btn-block mt-3">
          Change all email choices
        </Link>
      )}
      <p className="mt-4 text-xs text-slate-400">You can change this any time in Settings → Notifications.</p>
    </div>
  );
}
