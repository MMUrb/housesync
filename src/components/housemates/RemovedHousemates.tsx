"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { confirmSheet } from "@/components/app/ConfirmSheet";
import { showToast } from "@/components/app/Toast";
import { Avatar } from "@/components/Avatar";
import { createInvite, shareInvite } from "@/lib/invites";
import { formatDate } from "@/lib/format";
import type { RemovedHousemate } from "@/lib/data";

// How to refer to someone: "Sam" from "Sam Carter", or they/them when the
// person never set a name.
function words(p: RemovedHousemate) {
  const first = p.name?.trim().split(/\s+/)[0] || null;
  return {
    display: p.name?.trim() || "Former housemate",
    subject: first ?? "They", // start of a sentence
    object: first ?? "them", // after a verb
    was: first ? "was" : "were",
  };
}

/**
 * House admin only: the people they've removed. A removed person can't get
 * back in with any invite link; the admin has to invite them back here first
 * (and is asked to confirm, because of the removal). That sends a fresh
 * 10-minute link like any other invite.
 */
export function RemovedHousemates({
  houseId,
  houseName,
  people,
}: {
  houseId: string;
  houseName: string;
  people: RemovedHousemate[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setInvited(p: RemovedHousemate, invited: boolean): Promise<boolean> {
    setBusyId(p.userId);
    setError(null);
    const { error } = await createClient().rpc("set_house_reinvite", {
      p_house_id: houseId,
      p_user_id: p.userId,
      p_invited: invited,
    });
    setBusyId(null);
    if (error) {
      setError("Couldn't update that invite. Try again in a moment.");
      return false;
    }
    router.refresh();
    return true;
  }

  // A new 10-minute link each time, shared straight to them where the phone allows.
  async function sendLink(p: RemovedHousemate) {
    const w = words(p);
    setError(null);
    let invite;
    try {
      invite = await createInvite(houseId);
    } catch {
      setError("Couldn't make a link just now. Try again in a moment.");
      return;
    }
    const how = await shareInvite(invite, {
      title: `Rejoin ${houseName} on HouseSync`,
      text: `You're invited back to "${houseName}" on HouseSync. This link works for 10 minutes:`,
      dialogTitle: `Send ${w.object} the invite`,
    });
    if (how === "shared") showToast({ message: `${w.subject} can rejoin with that link for 10 minutes.` });
    else if (how === "copied") showToast({ message: `Link copied. Send it to ${w.object} within 10 minutes.` });
    else
      showToast({
        message: `${w.subject} can rejoin now. Send them a link.`,
        actionLabel: "Send link",
        onAction: () => sendLink(p),
      });
  }

  async function inviteBack(p: RemovedHousemate) {
    const w = words(p);
    const ok = await confirmSheet({
      title: `Invite ${w.object} back?`,
      body: `${w.subject} ${w.was} removed from ${houseName} on ${formatDate(p.removedAt, {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}. Are you sure you want to send them an invite?`,
      confirmLabel: "Send invite",
    });
    if (!ok || !(await setInvited(p, true))) return;
    await sendLink(p);
  }

  async function cancelInvite(p: RemovedHousemate) {
    if (await setInvited(p, false)) {
      showToast({ message: `Invite cancelled. ${words(p).subject} can't rejoin.` });
    }
  }

  return (
    <div className="space-y-2">
      <ul className="card divide-y divide-slate-100">
        {people.map((p) => {
          const busy = busyId === p.userId;
          return (
            <li key={p.userId} className="flex items-center gap-3 p-3.5">
              <Avatar name={p.name} color={p.color ?? undefined} avatarUrl={p.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">{words(p).display}</p>
                {p.reinvitedAt ? (
                  <p className="text-xs text-slate-400">
                    Invited back ·{" "}
                    <button
                      type="button"
                      onClick={() => cancelInvite(p)}
                      disabled={busy}
                      className="font-medium text-slate-500 underline-offset-2 hover:underline"
                    >
                      Cancel invite
                    </button>
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">Removed {formatDate(p.removedAt)}</p>
                )}
              </div>
              {p.reinvitedAt ? (
                <button
                  type="button"
                  onClick={() => sendLink(p)}
                  disabled={busy}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  Send link
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => inviteBack(p)}
                  disabled={busy}
                  className="btn-secondary shrink-0 px-3 py-1.5 text-xs"
                >
                  {busy ? "Inviting…" : "Invite back"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="px-1 text-xs text-red-600">{error}</p>}
      <p className="px-1 text-xs text-slate-400">
        Only you can see this. People you remove can&apos;t rejoin with any invite link until you
        invite them back.
      </p>
    </div>
  );
}
