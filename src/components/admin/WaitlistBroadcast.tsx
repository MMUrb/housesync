"use client";

import { useState } from "react";

export function WaitlistBroadcast({ count }: { count: number }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = subject.trim().length > 0 && message.trim().length > 0;
  const people = `${count} ${count === 1 ? "person" : "people"}`;

  function dirty() {
    setConfirming(false);
    setResult(null);
    setError(null);
  }

  async function send() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/waitlist-broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "Failed to send.");
      setResult(
        `Sent to ${j.sent} of ${j.total}${j.failed ? ` · ${j.failed} failed` : ""}.`,
      );
      setConfirming(false);
      setSubject("");
      setMessage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="text-sm font-medium text-slate-700">Email the waitlist</p>
        <p className="text-xs text-slate-400">
          Sends a one-off message to all {people} on the waitlist — e.g. a progress update or your
          launch announcement. Everyone gets it individually (no shared To: line).
        </p>
      </div>

      <input
        className="input"
        placeholder="Subject — e.g. HouseSync is live 🎉"
        value={subject}
        maxLength={200}
        onChange={(e) => {
          setSubject(e.target.value);
          dirty();
        }}
      />
      <textarea
        className="input min-h-[120px]"
        placeholder="Write your message… plain text — leave a blank line between paragraphs."
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          dirty();
        }}
      />

      {!confirming ? (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={!ready || busy || count === 0}
          className="btn-primary"
        >
          {count === 0 ? "No one on the waitlist yet" : "Review & send"}
        </button>
      ) : (
        <div className="rounded-xl bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-800">
            Send to all {people}? This goes out immediately and can&rsquo;t be undone.
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={send} disabled={busy} className="btn-primary">
              {busy ? "Sending…" : `Yes, send to ${count}`}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {result && <p className="text-xs font-medium text-mint-600">{result}</p>}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
