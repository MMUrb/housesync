"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushEnabled } from "@/components/push/pushClient";

export function PushToggle() {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushEnabled().then((v) => {
      setEnabled(v);
      setReady(true);
    });
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    if (enabled) {
      await disablePush();
      setEnabled(false);
    } else {
      const res = await enablePush();
      if (res.ok) setEnabled(true);
      else setError(res.reason ?? "Couldn't turn on notifications.");
    }
    setBusy(false);
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="pr-2">
          <p className="text-sm font-medium text-slate-800">Push notifications</p>
          <p className="text-xs text-slate-500">
            {enabled
              ? "On — you'll get alerts for new messages and house activity."
              : "Get alerted on this device for new messages, expenses and bill requests."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Push notifications"
          disabled={busy || !ready}
          onClick={toggle}
          className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
            enabled ? "bg-brand-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
              enabled ? "left-[22px]" : "left-0.5"
            }`}
          />
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
