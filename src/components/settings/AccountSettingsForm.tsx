"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AccountSettingsForm({
  userId,
  email,
  initialPhone,
  initialNotifyEmail,
  initialNotifySms,
}: {
  userId: string;
  email: string;
  initialPhone: string;
  initialNotifyEmail: boolean;
  initialNotifySms: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [phone, setPhone] = useState(initialPhone);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [notifySms, setNotifySms] = useState(initialNotifySms);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    const { error } = await supabase.from("account_settings").upsert(
      {
        user_id: userId,
        phone: phone.trim() || null,
        notify_email: notifyEmail,
        notify_sms: notifySms,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div>
        <label className="label" htmlFor="account-email">
          Email
        </label>
        <input
          id="account-email"
          className="input bg-slate-50 text-slate-500"
          value={email}
          readOnly
        />
        <p className="mt-1 text-xs text-slate-400">This is how you sign in.</p>
      </div>

      <div>
        <label className="label" htmlFor="account-phone">
          Phone number <span className="font-normal text-slate-400">(private)</span>
        </label>
        <input
          id="account-phone"
          type="tel"
          className="input"
          placeholder="e.g. +44 7700 900000"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-400">
          🔒 Never shown to your housemates — used only for reminders you turn on below.
        </p>
      </div>

      <div className="space-y-2">
        <span className="label">Reminders</span>
        <Toggle
          label="Email reminders"
          desc="Upcoming bills and gentle nudges, by email."
          checked={notifyEmail}
          onChange={setNotifyEmail}
        />
        <Toggle
          label="Text (SMS) reminders"
          desc="Opt in now — we'll text you once SMS reminders go live."
          checked={notifySms}
          onChange={setNotifySms}
        />
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : saved ? "Saved!" : "Save account"}
      </button>
    </form>
  );
}

function Toggle({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
      <div className="pr-3">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{desc}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked ? "bg-brand-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
