"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearActiveHouse } from "@/lib/activeHouse";
import { DELETION_REASONS } from "@/lib/deletion";

export function DangerZone({
  houseId,
  userId,
  isOwner,
  houseName,
}: {
  houseId: string;
  userId: string;
  isOwner: boolean;
  houseName: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  async function leave() {
    if (!confirm(`Leave ${houseName}? You can re-join later with the invite link.`)) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase
      .from("house_members")
      .delete()
      .eq("house_id", houseId)
      .eq("user_id", userId);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    clearActiveHouse();
    router.push("/house/create");
    router.refresh();
  }

  async function destroy() {
    if (
      !confirm(
        `Delete ${houseName} for everyone? This removes all expenses, bills and chores. This cannot be undone.`,
      )
    )
      return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.from("houses").delete().eq("id", houseId);
    if (error) {
      setError(error.message);
      setBusy(false);
      return;
    }
    clearActiveHouse();
    router.push("/house/create");
    router.refresh();
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
    <div className="card border-red-100 p-5">
      <h3 className="text-sm font-semibold text-red-700">Danger zone</h3>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 space-y-2">
        <button onClick={leave} disabled={busy} className="btn-danger btn-block">
          Leave this house
        </button>
        {isOwner && (
          <button onClick={destroy} disabled={busy} className="btn-danger btn-block">
            Delete this house
          </button>
        )}
        <div className="mt-3 border-t border-red-100 pt-3">
          {!showDelete ? (
            <>
              <button
                onClick={() => setShowDelete(true)}
                disabled={busy}
                className="btn-danger btn-block"
              >
                Delete my account
              </button>
              <p className="mt-1.5 text-xs text-slate-400">
                Deletes your account everywhere — all houses, profile and settings. This can&apos;t
                be undone.
              </p>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-700">
                Sorry to see you go — what&apos;s the main reason?
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
      </div>
    </div>
  );
}
