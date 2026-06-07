"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { clearActiveHouse } from "@/lib/activeHouse";

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
      </div>
    </div>
  );
}
