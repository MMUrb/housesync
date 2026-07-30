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
      <button onClick={leave} disabled={busy} className="btn-danger btn-block">
        Leave this house
      </button>
      {isOwner && (
        <button onClick={destroy} disabled={busy} className="btn-danger btn-block">
          Delete this house
        </button>
      )}
    </div>
  );
}
