"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${getSiteUrl()}/auth/callback?next=${encodeURIComponent("/reset-password")}`,
      });
      if (error) throw error;
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the reset link.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="card mt-8 space-y-3 p-6 text-center">
        <p className="text-3xl">📬</p>
        <p className="text-sm text-slate-700">
          If an account exists for <strong>{email.trim()}</strong>, we&rsquo;ve sent a password
          reset link. Check your inbox (and your spam/junk folder).
        </p>
        <Link href="/login" className="btn-secondary btn-block">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-3 p-6">
      <div>
        <label className="label" htmlFor="fp-email">
          Email
        </label>
        <input
          id="fp-email"
          type="email"
          className="input"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="btn-primary btn-block">
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <Link
        href="/login"
        className="block text-center text-sm text-slate-500 hover:text-slate-700"
      >
        Back to sign in
      </Link>
    </form>
  );
}
