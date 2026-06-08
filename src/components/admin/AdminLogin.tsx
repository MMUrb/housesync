"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Couldn't unlock.");
      }
      setPassword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't unlock.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mx-auto max-w-sm space-y-3 p-6 text-center">
      <p className="text-3xl">🔐</p>
      <h1 className="text-lg font-bold text-slate-900">Enter admin password</h1>
      <p className="text-sm text-slate-500">
        This area needs a second password on top of your sign-in.
      </p>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Admin password"
        className="input w-full text-center"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={busy || !password} className="btn-primary btn-block">
        {busy ? "Unlocking…" : "Unlock"}
      </button>
    </form>
  );
}

export function LockButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function lock() {
    setBusy(true);
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    router.refresh();
  }
  return (
    <button
      onClick={lock}
      disabled={busy}
      className="btn-ghost text-sm"
      title="Lock the admin area"
    >
      Lock
    </button>
  );
}
