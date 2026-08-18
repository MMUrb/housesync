"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearActiveHouse } from "@/lib/activeHouse";

// House-scoped destructive actions (leave / delete this house), shown inside
// the "Leave or delete this house" disclosure on Settings. Account deletion
// moved to AccountSettingsForm — it is an account action, not a house one.
export function DangerZone({
  houseId,
  userId,
  isOwner,
  houseName,
  othersCount = 0,
}: {
  houseId: string;
  userId: string;
  isOwner: boolean;
  houseName: string;
  /** How many other people are in the house (drives the admin-leave rule). */
  othersCount?: number;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // An admin leaving would orphan the house: nobody left could delete it,
  // remove anyone or change its settings. Hand over first (House admin row
  // above), or delete the house if it's finished with.
  const adminMustHandOver = isOwner && othersCount > 0;

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

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        Leaving removes you from {houseName} only — your account and other houses are untouched.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      {adminMustHandOver ? (
        <>
          <button disabled className="btn-danger btn-block">
            Leave this house
          </button>
          <p className="text-xs leading-relaxed text-amber-700">
            You&apos;re the house admin. Hand the role to a housemate first (House admin, above),
            or delete the house if everyone&apos;s done with it.
          </p>
        </>
      ) : (
        <button onClick={leave} disabled={busy} className="btn-danger btn-block">
          Leave this house
        </button>
      )}
      {isOwner && (
        <button onClick={destroy} disabled={busy} className="btn-danger btn-block">
          Delete this house
        </button>
      )}
    </div>
  );
}
