"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmSheet } from "@/components/app/ConfirmSheet";
import { showToast } from "@/components/app/Toast";

// House admin only: take someone out of the house. The database remembers the
// removal (migration 0046), so the invite link on its own won't get them back
// in. Only the admin inviting them back from the Housemates page will.
export function RemoveHousemate({
  houseId,
  houseName,
  memberId,
  firstName,
  balanceNote,
}: {
  houseId: string;
  houseName: string;
  memberId: string;
  firstName: string;
  /** e.g. "still owe £40", so an open balance is never a surprise. */
  balanceNote?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (
      !(await confirmSheet({
        title: `Remove ${firstName} from ${houseName}?`,
        body:
          `${firstName} will lose access straight away and can only rejoin if you invite them back.` +
          (balanceNote ? ` They ${balanceNote}, which stays on the books.` : ""),
        confirmLabel: "Remove",
        tone: "danger",
      }))
    )
      return;
    setBusy(true);
    setError(null);
    const { data, error } = await createClient()
      .from("house_members")
      .delete()
      .eq("house_id", houseId)
      .eq("user_id", memberId)
      .select("user_id");
    if (error) {
      setError(`Couldn't remove ${firstName} just now. Check your connection and try again.`);
      setBusy(false);
      return;
    }
    // Zero rows is RLS saying there was nothing to delete: in practice they
    // left (or were removed) since this page loaded.
    if (!data?.length) {
      showToast({ message: `${firstName} isn't in ${houseName} any more.` });
      router.push("/housemates");
      router.refresh();
      return;
    }
    showToast({ message: `${firstName} was removed from ${houseName}` });
    router.push("/housemates");
    router.refresh();
  }

  return (
    <div className="card space-y-2 p-5">
      <span className="label">Remove from house</span>
      <p className="text-xs leading-relaxed text-slate-500">
        {firstName} could only come back if you invite them back first. An ordinary invite link
        won&apos;t let them in.
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button onClick={remove} disabled={busy} className="btn-danger btn-block">
        {busy ? "Removing…" : `Remove ${firstName}`}
      </button>
    </div>
  );
}
