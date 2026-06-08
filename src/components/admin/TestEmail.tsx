"use client";

import { useState } from "react";

export function TestEmail() {
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!to.trim() || busy) return;
    setBusy(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: to.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to send.");
      setResult(`Sent to ${to.trim()}. Check the inbox / mail-tester score.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-2 p-4">
      <p className="text-sm font-medium text-slate-700">Send a test email</p>
      <p className="text-xs text-slate-400">
        Fires a sample through the real email path. Send it to a{" "}
        <a
          href="https://www.mail-tester.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand-600 hover:underline"
        >
          mail-tester.com
        </a>{" "}
        address for a spam score + reasons, or to a couple of your own inboxes.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="test-xxxx@srv1.mail-tester.com"
          className="input flex-1"
        />
        <button onClick={send} disabled={busy || !to.trim()} className="btn-primary shrink-0">
          {busy ? "Sending…" : "Send test"}
        </button>
      </div>
      {result && <p className="text-xs font-medium text-mint-600">{result}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
