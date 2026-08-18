"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { haptic } from "@/lib/haptics";

// Hand the house admin role to another housemate. One atomic RPC
// (transfer_house_admin, migration 0040) moves both the owner column and the
// admin tag, posts an activity row and a system note in chat. Not undoable
// from this side: after it succeeds you are a regular member and only the
// new admin can hand it back.

export interface TransferCandidate {
  userId: string;
  name: string;
  color: string;
  avatarUrl: string | null;
}

/** The RPC raises short codes; turn them into sentences. */
function friendlyError(message: string): string {
  if (message.includes("transfer_not_admin")) return "Only the current house admin can hand over the role.";
  if (message.includes("transfer_not_member")) return "That person isn't in this house any more.";
  if (message.includes("transfer_same_person")) return "You're already the admin.";
  if (message.includes("house_not_found")) return "This house couldn't be found. Refresh and try again.";
  return message;
}

export function TransferAdminForm({
  houseId,
  houseName,
  candidates,
}: {
  houseId: string;
  houseName: string;
  candidates: TransferCandidate[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [picked, setPicked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chosen = candidates.find((c) => c.userId === picked) ?? null;

  async function transfer() {
    if (!chosen || saving) return;
    if (
      !confirm(
        `Make ${chosen.name} the admin of ${houseName}?\n\nYou'll become a regular housemate. Only ${chosen.name} will be able to hand it back.`,
      )
    )
      return;
    setError(null);
    setSaving(true);
    void haptic("light");
    const { error } = await supabase.rpc("transfer_house_admin", {
      p_house_id: houseId,
      p_new_admin: chosen.userId,
    });
    setSaving(false);
    if (error) {
      setError(friendlyError(error.message));
      router.refresh();
      return;
    }
    void haptic("success");
    setPicked(null);
    router.refresh();
  }

  if (candidates.length === 0) {
    return (
      <p className="text-xs leading-relaxed text-slate-500">
        You&apos;re the only one here. Invite a housemate first, then you can hand over the
        admin role.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-slate-500">
        The admin can delete the house, remove housemates and change how the house settles up.
        Pick who should have that instead of you.
      </p>

      <div
        role="radiogroup"
        aria-label="New house admin"
        className="overflow-hidden rounded-xl border border-slate-200"
      >
        {candidates.map((c, i) => {
          const active = picked === c.userId;
          return (
            <button
              key={c.userId}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPicked(active ? null : c.userId)}
              disabled={saving}
              className={`flex w-full items-center gap-3 p-3 text-left transition ${
                i > 0 ? "border-t border-slate-200" : ""
              } ${active ? "bg-brand-50" : "bg-white hover:bg-slate-50"}`}
            >
              <span
                aria-hidden="true"
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${
                  active ? "border-brand-600" : "border-slate-300"
                }`}
              >
                {active && <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />}
              </span>
              <Avatar name={c.name} color={c.color} avatarUrl={c.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
                {c.name}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={transfer}
        disabled={!chosen || saving}
        className="btn-primary btn-block"
      >
        {saving ? "Handing over…" : chosen ? `Make ${chosen.name} the admin` : "Choose a housemate"}
      </button>

      {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
