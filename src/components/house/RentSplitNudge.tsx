"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { firstName, formatMoney } from "@/lib/format";

type Member = { id: string; name: string; color: string | null; avatarUrl: string | null };

// Per device on purpose, like the parked invite card: it's a reminder
// preference, not house data. The roster key remembers which members this
// device has already seen, so only genuinely new joiners trigger the sheet.
const rosterKey = (houseId: string) => `hs_rent_roster::${houseId}`;
const neverKey = (houseId: string) => `hs_rent_nudge_never::${houseId}`;

/**
 * "Sam just joined" sheet for the person who pays the rent bill: every join
 * is one reminder that the split doesn't include the newcomer until they act.
 * "Not now" holds until the NEXT join; "Never show this again" is permanent.
 * First sight of a house only records the current roster (no sheet), so
 * existing houses don't all fire on rollout.
 */
export function RentSplitNudge({
  houseId,
  houseName,
  currency,
  members,
  bill,
}: {
  houseId: string;
  houseName: string;
  currency: string;
  members: Member[];
  /** The house's rent bill; the server only renders this for its payer. */
  bill: { id: string; amount: number };
}) {
  const router = useRouter();
  const [newcomers, setNewcomers] = useState<Member[] | null>(null);

  useEffect(() => {
    const ids = members.map((m) => m.id);
    let stored: string[] | null = null;
    let never = false;
    try {
      never = localStorage.getItem(neverKey(houseId)) === "1";
      const raw = localStorage.getItem(rosterKey(houseId));
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) stored = parsed.filter((x) => typeof x === "string");
      }
    } catch {
      return; // No storage, no nudge: it would fire on every single visit.
    }
    const writeRoster = () => {
      try {
        localStorage.setItem(rosterKey(houseId), JSON.stringify(ids));
      } catch {
        /* next visit tries again */
      }
    };
    if (never || stored === null) {
      writeRoster();
      return;
    }
    const seen = stored;
    const fresh = members.filter((m) => !seen.includes(m.id));
    if (fresh.length === 0) {
      writeRoster(); // keeps leavers pruned, so a re-join counts as new
      return;
    }
    setNewcomers(fresh); // roster is only written once they answer the sheet
  }, [houseId, members]);

  useEffect(() => {
    if (!newcomers) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && acknowledge();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newcomers]);

  function acknowledge() {
    try {
      localStorage.setItem(rosterKey(houseId), JSON.stringify(members.map((m) => m.id)));
    } catch {
      /* fine */
    }
    setNewcomers(null);
  }

  function neverAgain() {
    try {
      localStorage.setItem(neverKey(houseId), "1");
    } catch {
      /* fine */
    }
    acknowledge();
  }

  function updateSplit() {
    acknowledge();
    router.push(`/bills#bill-${bill.id}`);
  }

  if (!newcomers || newcomers.length === 0) return null;

  const lead = newcomers[0];
  const leadName = firstName(lead.name);
  const title =
    newcomers.length === 1
      ? `${leadName} just joined 🎉`
      : newcomers.length === 2
        ? `${leadName} and ${firstName(newcomers[1].name)} just joined 🎉`
        : `${leadName} and ${newcomers.length - 1} others just joined 🎉`;
  const who = newcomers.length === 1 ? leadName : "them";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={acknowledge}
      role="dialog"
      aria-modal="true"
      aria-label="Update the rent split"
    >
      <div
        className="card w-full max-w-md rounded-b-none rounded-t-2xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden dark:bg-white/15" />
        <div className="flex items-center gap-3">
          <Avatar
            name={lead.name}
            color={lead.color ?? undefined}
            avatarUrl={lead.avatarUrl ?? undefined}
            size="md"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              {houseName} is {members.length} people now
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-slate-600">
          Rent, <b>{formatMoney(bill.amount, currency)} a month</b>, doesn&rsquo;t include {who}{" "}
          yet. Update the split when you&rsquo;re ready, nothing changes until you do.
        </p>
        <button type="button" onClick={updateSplit} className="btn-primary btn-block mt-4">
          Update the rent split
        </button>
        <button type="button" onClick={acknowledge} className="btn-secondary btn-block mt-2">
          Not now
        </button>
        <button
          type="button"
          onClick={neverAgain}
          className="mx-auto mt-3 block text-xs font-medium text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          Never show this again
        </button>
      </div>
    </div>
  );
}
