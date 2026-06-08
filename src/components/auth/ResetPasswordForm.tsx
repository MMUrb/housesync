"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function ResetPasswordForm() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<boolean | null>(null);

  // The reset link routes through /auth/callback, which exchanges the code and
  // sets a (recovery) session before redirecting here. Confirm it exists.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
  }, [supabase]);

  const checks = {
    length: password.length >= 6,
    upper: /[A-Z]/.test(password),
    number: /[0-9]/.test(password),
  };
  const valid = checks.length && checks.upper && checks.number;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't update your password.");
      setBusy(false);
    }
  }

  if (ready === false) {
    return (
      <div className="card mt-8 space-y-3 p-6 text-center">
        <p className="text-3xl">⚠️</p>
        <p className="text-sm text-slate-600">
          This reset link is invalid or has expired. Request a new one from the sign-in page.
        </p>
        <a href="/forgot-password" className="btn-secondary btn-block">
          Request a new link
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card mt-8 space-y-3 p-6">
      <div>
        <label className="label" htmlFor="rp-pw">
          New password
        </label>
        <input
          id="rp-pw"
          type="password"
          className="input"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <ul className="mt-2 space-y-1 text-xs">
          <Req ok={checks.length} text="At least 6 characters" />
          <Req ok={checks.upper} text="At least one uppercase letter" />
          <Req ok={checks.number} text="At least one number" />
        </ul>
      </div>
      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || !valid} className="btn-primary btn-block">
        {busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

function Req({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className={`flex items-center gap-1.5 ${ok ? "text-mint-600" : "text-slate-400"}`}>
      <span aria-hidden className="font-semibold">
        {ok ? "✓" : "○"}
      </span>
      <span>{text}</span>
    </li>
  );
}
