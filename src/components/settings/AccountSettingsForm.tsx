"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";
import { PhoneVerification } from "@/components/settings/PhoneVerification";

export function AccountSettingsForm({
  userId,
  email,
  initialPhone,
  initialPhoneVerified,
  initialNotifyEmail,
  initialNotifySms,
  emailVerified,
}: {
  userId: string;
  email: string;
  initialPhone: string;
  initialPhoneVerified: boolean;
  initialNotifyEmail: boolean;
  initialNotifySms: boolean;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [notifySms, setNotifySms] = useState(initialNotifySms);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    setSaved(false);
    // Note: phone + phone_verified are managed by the verification flow on the
    // server — they're intentionally not written from here.
    const { error } = await supabase.from("account_settings").upsert(
      {
        user_id: userId,
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

  async function verifyEmail() {
    setError(null);
    setVerifying(true);
    try {
      const res = await fetch("/api/email/verify-send", { method: "POST" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not send the verification email.");
      }
      setVerifySent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the verification email.");
    } finally {
      setVerifying(false);
    }
  }

  async function changeEmail() {
    setError(null);
    setEmailMsg(null);
    const next = newEmail.trim();
    if (!next || next === email) {
      setError("Enter a different email address.");
      return;
    }
    setEmailBusy(true);
    try {
      // Supabase sends a confirmation link; the email only changes (and is
      // re-verified) once the user clicks it.
      const { error } = await supabase.auth.updateUser(
        { email: next },
        { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
      );
      if (error) throw error;
      setEmailMsg(
        `Confirmation sent to ${next}. Check your inbox and your spam/junk folder. Your email stays the same until you click the link in that message.`,
      );
      setChangingEmail(false);
      setNewEmail("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the email change.");
    } finally {
      setEmailBusy(false);
    }
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
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {emailVerified ? (
            <span className="font-medium text-mint-600">✓ Email verified</span>
          ) : verifySent ? (
            <span className="text-mint-600">
              Verification email sent. Check your inbox (and your spam/junk folder).
            </span>
          ) : (
            <>
              <span className="text-amber-600">Email not verified</span>
              <button
                type="button"
                onClick={verifyEmail}
                disabled={verifying}
                className="font-medium text-brand-600 hover:underline disabled:opacity-50"
              >
                {verifying ? "Sending…" : "Verify now"}
              </button>
            </>
          )}
          <span className="text-slate-300">·</span>
          <button
            type="button"
            onClick={() => {
              setChangingEmail((v) => !v);
              setEmailMsg(null);
            }}
            className="font-medium text-brand-600 hover:underline"
          >
            Change email
          </button>
        </div>

        {changingEmail && (
          <div className="mt-2 space-y-2">
            <input
              type="email"
              className="input"
              placeholder="new@email.com"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={changeEmail}
                disabled={emailBusy}
                className="btn-primary px-3 py-1.5 text-sm"
              >
                {emailBusy ? "Sending…" : "Send confirmation"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setChangingEmail(false);
                  setNewEmail("");
                }}
                className="btn-ghost px-3 py-1.5 text-sm"
              >
                Cancel
              </button>
            </div>
            <p className="text-xs text-slate-400">
              We&apos;ll email a confirmation link to the new address. Your email only changes once
              you click it, so it stays verified.
            </p>
          </div>
        )}

        {emailMsg && (
          <p className="mt-2 rounded-xl bg-mint-50 px-3 py-2 text-xs text-mint-700">{emailMsg}</p>
        )}
      </div>

      <div>
        <span className="label">Phone number</span>
        <PhoneVerification initialPhone={initialPhone} initialVerified={initialPhoneVerified} />
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
          desc="Sent to your verified phone number once SMS reminders go live."
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
