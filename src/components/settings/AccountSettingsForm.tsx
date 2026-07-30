"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getSiteUrl } from "@/lib/env";
import { clearActiveHouse } from "@/lib/activeHouse";
import { DELETION_REASONS } from "@/lib/deletion";

// Email verification + email change, plus (at the very bottom, deliberately
// quiet) account deletion — an account-wide action that used to be misfiled
// under the house's danger zone. The old "Email reminders" toggle moved to the
// Notifications panel, and everything left here is an instant action, so the
// form-wide Save button is gone.
export function AccountSettingsForm({
  email,
  emailVerified,
  bare = false,
}: {
  email: string;
  emailVerified: boolean;
  /** Render without the card chrome (when shown inside a settings panel). */
  bare?: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifySent, setVerifySent] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState<string | null>(null);

  // Account deletion (moved from the old DangerZone, flow unchanged).
  const [busy, setBusy] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

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

  async function deleteAccount() {
    if (!reason) return;
    if (!confirm("Permanently delete your account? This cannot be undone.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, comment: comment.trim() || null }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not delete your account.");
      }
      clearActiveHouse();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete your account.");
      setBusy(false);
    }
  }

  return (
    <div className={bare ? "space-y-4" : "card space-y-4 p-5"}>
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

      {/* Account deletion — quiet until deliberately opened. */}
      <div className="border-t border-slate-100 pt-3">
        {!showDelete ? (
          <>
            <button
              type="button"
              onClick={() => setShowDelete(true)}
              disabled={busy}
              className="-mx-3 -my-2.5 inline-flex min-h-[44px] items-center px-3 py-2.5 text-sm font-medium text-red-600 hover:underline"
            >
              Delete my account
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Deletes your account everywhere: all houses, profile and settings. This can&apos;t be
              undone.
            </p>
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-slate-700">
              Sorry to see you go. What&apos;s the main reason?
            </p>
            <div className="space-y-1.5">
              {DELETION_REASONS.map((r) => (
                <label
                  key={r.code}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-600"
                >
                  <input
                    type="radio"
                    name="delete-reason"
                    value={r.code}
                    checked={reason === r.code}
                    onChange={() => setReason(r.code)}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {r.label}
                </label>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={2}
              placeholder="Anything you'd like to add? (optional)"
              className="input w-full resize-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setReason("");
                  setComment("");
                  setError(null);
                }}
                disabled={busy}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteAccount}
                disabled={busy || !reason}
                className="btn-danger flex-1"
              >
                {busy ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
