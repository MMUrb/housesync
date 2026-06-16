"use client";

import { useState } from "react";

export function WaitlistForm({ returnTo = "/" }: { returnTo?: string }) {
  const [email, setEmail] = useState("");
  const [joinState, setJoinState] = useState<"idle" | "loading" | "done">("idle");
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const [already, setAlready] = useState(false);
  // The email a "Wrong email? Edit it" correction will replace, so the old
  // (mistyped) row is removed instead of leaving a duplicate on the list.
  const [correctingFrom, setCorrectingFrom] = useState("");

  const [showCode, setShowCode] = useState(false);
  const [code, setCode] = useState("");
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeErr, setCodeErr] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setJoinErr(null);
    setJoinState("loading");
    try {
      const res = await fetch("/api/waitlist/join", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, replaces: correctingFrom || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setJoinErr(data?.error ?? "Something went wrong. Please try again.");
        setJoinState("idle");
        return;
      }
      setAlready(Boolean(data?.already));
      setCorrectingFrom(""); // correction (if any) has been applied
      setJoinState("done");
    } catch {
      setJoinErr("Network error. Please try again.");
      setJoinState("idle");
    }
  }

  async function unlock(e: React.FormEvent) {
    e.preventDefault();
    setCodeErr(null);
    setCodeLoading(true);
    try {
      const res = await fetch("/api/waitlist/unlock", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setCodeErr(data?.error ?? "That code isn't right.");
        setCodeLoading(false);
        return;
      }
      // Unlocked — go back to the page the visitor originally asked for
      // (middleware forwards it; "/" on a direct /waitlist visit).
      window.location.href = returnTo;
    } catch {
      setCodeErr("Network error. Please try again.");
      setCodeLoading(false);
    }
  }

  return (
    <div className="mt-6">
      {joinState === "done" ? (
        <div className="rounded-xl bg-mint-50 p-4 text-center">
          <p className="text-2xl">🎉</p>
          <p className="mt-1 font-semibold text-slate-900">
            {already ? "You're already on the list!" : "You're on the list!"}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {already
              ? "We've already got this email, we'll be in touch with updates."
              : "We've sent a confirmation. Check your inbox."}
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-slate-900">{email}</p>
          {!already && (
            <p className="mt-2 text-xs text-slate-500">
              {"Can't see it? Check your junk or spam folder, and move it to your inbox so future emails land there too."}
            </p>
          )}
          <button
            type="button"
            onClick={() => {
              setCorrectingFrom(email); // remember the email this edit will replace
              setJoinState("idle");
              setJoinErr(null);
            }}
            className="mt-2 text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Wrong email? Edit it
          </button>
        </div>
      ) : (
        <form onSubmit={join} className="space-y-3">
          <input
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            className="input"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" disabled={joinState === "loading"} className="btn-primary btn-block">
            {joinState === "loading" ? "Joining…" : "Join the waitlist"}
          </button>
          {joinErr && <p className="text-sm text-red-600">{joinErr}</p>}
        </form>
      )}

      {/* Access code — small, below the main form */}
      <div className="mt-5 border-t border-slate-100 pt-4 text-center">
        {!showCode ? (
          <button
            type="button"
            onClick={() => setShowCode(true)}
            className="text-xs font-medium text-slate-400 transition hover:text-slate-600"
          >
            Have an access code?
          </button>
        ) : (
          <form onSubmit={unlock} className="mx-auto max-w-xs space-y-2">
            <input
              autoFocus
              className="input text-center"
              placeholder="Enter access code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <button type="submit" disabled={codeLoading} className="btn-secondary btn-block">
              {codeLoading ? "Checking…" : "Unlock access"}
            </button>
            {codeErr && <p className="text-sm text-red-600">{codeErr}</p>}
          </form>
        )}
      </div>
    </div>
  );
}
