"use client";

import { useEffect, useState } from "react";
import { disablePush, enablePush, getPushEnabled, getPlatform } from "@/components/push/pushClient";
import { createClient } from "@/lib/supabase/client";
import { IconChevronDown } from "@/components/icons";

type PrefKey = "message" | "expense" | "bill" | "paid" | "chore" | "member";
type Prefs = Record<PrefKey, boolean>;

// Each toggle and the account_settings column it writes to.
const TYPES: { key: PrefKey; col: string; label: string; desc: string }[] = [
  { key: "message", col: "notify_push_message", label: "Chat messages", desc: "When a housemate sends a message" },
  { key: "expense", col: "notify_push_expense", label: "New expenses", desc: "When someone adds an expense" },
  { key: "bill", col: "notify_push_bill", label: "Bill requests", desc: "When someone requests a bill payment" },
  { key: "paid", col: "notify_push_paid", label: "Payments to you", desc: "When someone pays you back" },
  { key: "chore", col: "notify_push_chore", label: "Chores assigned to you", desc: "When a housemate gives you a chore" },
  { key: "member", col: "notify_push_member", label: "New housemates", desc: "When someone joins your house" },
];

function Switch({
  checked,
  onClick,
  disabled,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-50 ${
        checked ? "bg-brand-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function PushToggle({ userId, initialPrefs }: { userId: string; initialPrefs: Prefs }) {
  const supabase = createClient();
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [prefs, setPrefs] = useState<Prefs>(initialPrefs);
  const [open, setOpen] = useState(false);
  const [hideForIos, setHideForIos] = useState(false);

  useEffect(() => {
    (async () => {
      // iOS native push (APNs) isn't wired up yet, so the toggle would switch on
      // but never deliver a notification. Hide it on iPhone until that's built.
      // Web push and Android FCM both work, so only iOS is hidden.
      if ((await getPlatform()) === "ios") {
        setHideForIos(true);
        return;
      }
      setEnabled(await getPushEnabled());
      setReady(true);
    })();
  }, []);

  async function toggle() {
    setBusy(true);
    setError(null);
    if (enabled) {
      await disablePush();
      setEnabled(false);
    } else {
      const res = await enablePush();
      if (res.ok) {
        setEnabled(true);
        setOpen(true); // reveal the per-type choices the first time they turn it on
      } else setError(res.reason ?? "Couldn't turn on notifications.");
    }
    setBusy(false);
  }

  async function savePref(key: PrefKey, col: string, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    const { error: upErr } = await supabase
      .from("account_settings")
      .upsert({ user_id: userId, [col]: value }, { onConflict: "user_id" });
    if (upErr) {
      setPrefs((p) => ({ ...p, [key]: !value })); // revert on failure
      setError("Couldn't save that preference. Please try again.");
    }
  }

  // iOS native: push isn't wired, so don't render a toggle that does nothing.
  if (hideForIos) return null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="pr-2">
          <p className="text-sm font-medium text-slate-800">Push notifications</p>
          <p className="text-xs text-slate-500">
            {enabled
              ? "On — pick exactly what you're notified about below."
              : "Get alerted on this device for new messages, expenses and bill requests."}
          </p>
        </div>
        <Switch checked={enabled} onClick={toggle} disabled={busy || !ready} label="Push notifications" />
      </div>

      {enabled && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex w-full items-center justify-between"
          >
            <span className="text-sm font-medium text-slate-800">Choose what you&apos;re notified about</span>
            <IconChevronDown
              className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
            />
          </button>

          {open && (
            <ul className="mt-3 space-y-3">
              {TYPES.map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-3">
                  <div className="pr-2">
                    <p className="text-sm text-slate-700">{t.label}</p>
                    <p className="text-xs text-slate-500">{t.desc}</p>
                  </div>
                  <Switch
                    checked={prefs[t.key]}
                    onClick={() => savePref(t.key, t.col, !prefs[t.key])}
                    label={t.label}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
