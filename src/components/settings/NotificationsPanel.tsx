"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { disablePush, enablePush, getPushEnabled } from "@/components/push/pushClient";
import { createClient } from "@/lib/supabase/client";

// One home for every notification choice: push (this device) on top, email
// below. Replaces the old PushToggle + EmailToggle cards and the "Email
// reminders" toggle that was stranded in the account form. Everything here
// autosaves optimistically to its own account_settings column and reverts on
// failure, so the panel needs no save button.

type PushKey = "message" | "expense" | "bill" | "paid" | "chore" | "member";
type EmailKey = "bills" | "nudges" | "product" | "tips" | "surveys" | "offers";
export type PushPrefs = Record<PushKey, boolean>;
export type EmailPrefs = Record<EmailKey, boolean>;

const PUSH_TYPES: { key: PushKey; col: string; label: string; desc: string }[] = [
  { key: "message", col: "notify_push_message", label: "Chat messages", desc: "When a housemate sends a message" },
  { key: "expense", col: "notify_push_expense", label: "New expenses", desc: "When someone adds an expense" },
  { key: "bill", col: "notify_push_bill", label: "Bill requests", desc: "When someone requests a bill payment" },
  { key: "paid", col: "notify_push_paid", label: "Payments to you", desc: "When someone pays you back" },
  { key: "chore", col: "notify_push_chore", label: "Chores assigned to you", desc: "When a housemate gives you a chore" },
  { key: "member", col: "notify_push_member", label: "New housemates", desc: "When someone joins your house" },
];

const EMAIL_TYPES: { key: EmailKey; col: string; label: string; desc: string }[] = [
  { key: "bills", col: "notify_email_bills", label: "Bill reminders", desc: "When a recurring bill is due soon" },
  { key: "nudges", col: "notify_email_nudges", label: "Payment reminders", desc: "A weekly nudge when you owe money" },
  { key: "product", col: "notify_email_product", label: "Product updates", desc: "New features and improvements" },
  { key: "tips", col: "notify_email_tips", label: "Tips and guides", desc: "Getting the most out of HouseSync" },
  { key: "surveys", col: "notify_email_surveys", label: "Surveys and feedback", desc: "Occasional requests for your input" },
  { key: "offers", col: "notify_email_offers", label: "Special offers", desc: "Deals and promotions" },
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">{children}</p>
  );
}

export function NotificationsPanel({
  userId,
  initialPush,
  initialEmailTypes,
  initialNotifyEmail,
}: {
  userId: string;
  initialPush: PushPrefs;
  initialEmailTypes: EmailPrefs;
  initialNotifyEmail: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);

  // Push master reflects this device's real permission state, known only
  // client-side — start neutral and resolve after mount.
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushReady, setPushReady] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [pushPrefs, setPushPrefs] = useState<PushPrefs>(initialPush);

  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState<EmailPrefs>(initialEmailTypes);

  useEffect(() => {
    getPushEnabled().then((v) => {
      setPushEnabled(v);
      setPushReady(true);
    });
  }, []);

  async function togglePush() {
    setPushBusy(true);
    setPushError(null);
    if (pushEnabled) {
      await disablePush();
      setPushEnabled(false);
    } else {
      const res = await enablePush();
      if (res.ok) setPushEnabled(true);
      else setPushError(res.reason ?? "Couldn't turn on notifications.");
    }
    setPushBusy(false);
  }

  async function saveColumn(col: string, value: boolean, revert: () => void) {
    const { error: upErr } = await supabase
      .from("account_settings")
      .upsert({ user_id: userId, [col]: value }, { onConflict: "user_id" });
    if (upErr) {
      revert();
      setError("Couldn't save that preference. Please try again.");
      return;
    }
    // Keep the server-rendered seed props in sync, so the panel doesn't show
    // stale values if it is collapsed and reopened.
    router.refresh();
  }

  function savePushPref(key: PushKey, col: string, value: boolean) {
    setPushPrefs((p) => ({ ...p, [key]: value }));
    void saveColumn(col, value, () => setPushPrefs((p) => ({ ...p, [key]: !value })));
  }

  function saveEmailPref(key: EmailKey, col: string, value: boolean) {
    setEmailPrefs((p) => ({ ...p, [key]: value }));
    void saveColumn(col, value, () => setEmailPrefs((p) => ({ ...p, [key]: !value })));
  }

  // Serialized (one write in flight) so a rapid double-tap can't land writes
  // out of order and leave the DB opposite to the switch.
  async function saveNotifyEmail(value: boolean) {
    setEmailBusy(true);
    setNotifyEmail(value);
    await saveColumn("notify_email", value, () => setNotifyEmail(!value));
    setEmailBusy(false);
  }

  return (
    <div className="space-y-4">
      {/* On this device */}
      <div>
        <SectionLabel>On this device</SectionLabel>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="pr-2">
            <p className="text-sm font-semibold text-slate-800">Push notifications</p>
            <p className="text-xs text-slate-500">
              {pushEnabled
                ? "On — pick exactly what you're notified about below."
                : "Get alerted on this device for new messages, expenses and bill requests."}
            </p>
          </div>
          <Switch
            checked={pushEnabled}
            onClick={togglePush}
            disabled={pushBusy || !pushReady}
            label="Push notifications"
          />
        </div>
        {pushError && <p className="mt-2 text-xs text-red-600">{pushError}</p>}
        {pushEnabled && (
          <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3">
            {PUSH_TYPES.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3">
                <div className="pr-2">
                  <p className="text-sm text-slate-700">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </div>
                <Switch
                  checked={pushPrefs[t.key]}
                  onClick={() => savePushPref(t.key, t.col, !pushPrefs[t.key])}
                  label={t.label}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* By email */}
      <div className="border-t border-slate-100 pt-4">
        <SectionLabel>By email</SectionLabel>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="pr-2">
            <p className="text-sm font-semibold text-slate-800">Email reminders</p>
            <p className="text-xs text-slate-500">Upcoming bills and gentle nudges, by email.</p>
          </div>
          <Switch
            checked={notifyEmail}
            onClick={() => void saveNotifyEmail(!notifyEmail)}
            disabled={emailBusy}
            label="Email reminders"
          />
        </div>
        <ul className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          {EMAIL_TYPES.map((t) => (
            <li key={t.key} className="flex items-center justify-between gap-3">
              <div className="pr-2">
                <p className="text-sm text-slate-700">{t.label}</p>
                <p className="text-xs text-slate-500">{t.desc}</p>
              </div>
              <Switch
                checked={emailPrefs[t.key]}
                onClick={() => saveEmailPref(t.key, t.col, !emailPrefs[t.key])}
                label={t.label}
              />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-400">
          Account and security emails (sign-in, verification, password) are always sent.
        </p>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
