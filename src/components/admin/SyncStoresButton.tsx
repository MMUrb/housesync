"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StoreOutcome = {
  configured: boolean;
  upserted?: number;
  notPublishedYet?: number;
  reviews?: number;
  error?: string;
};

function label(name: string, o?: StoreOutcome): string {
  if (!o || !o.configured) return `${name}: not configured`;
  if (o.error) return `${name}: failed (${o.error.slice(0, 80)}…)`;
  const days = `${o.upserted ?? 0} day${(o.upserted ?? 0) === 1 ? "" : "s"}`;
  const reviews =
    typeof o.reviews === "number"
      ? `, ${o.reviews} review${o.reviews === 1 ? "" : "s"}`
      : "";
  return `${name}: ${days}${reviews} synced`;
}

/** Runs the store sync on demand, admin-session authenticated. */
export function SyncStoresButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  async function go() {
    setBusy(true);
    setResult(null);
    setFailed(false);
    try {
      const res = await fetch("/api/admin/store-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ days: 30 }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Sync failed.");
      const ios = j.ios as StoreOutcome | undefined;
      const android = j.android as StoreOutcome | undefined;
      setFailed(Boolean(ios?.error || android?.error));
      setResult(`${label("iOS", ios)} · ${label("Android", android)}`);
      router.refresh();
    } catch (e) {
      setFailed(true);
      setResult(e instanceof Error ? e.message : "Sync failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2 text-xs">
      {result && (
        <span className={failed ? "text-amber-600" : "text-mint-600"}>{result}</span>
      )}
      <button
        type="button"
        onClick={go}
        disabled={busy}
        title="Pulls the last 30 days from both stores now instead of waiting for tonight's run."
        className="font-medium text-brand-600 hover:underline disabled:opacity-50"
      >
        {busy ? "Syncing…" : "Sync now"}
      </button>
    </span>
  );
}
