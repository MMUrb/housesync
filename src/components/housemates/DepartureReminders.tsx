"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { DepartureReminder } from "@/lib/data";

// Per device, like the other nudges: dismissing is a layout preference. Keyed
// on the departure time, so leaving again later brings the reminder back.
const seenKey = (houseId: string, r: DepartureReminder) =>
  `hs_departure_seen:${houseId}:${r.userId}:${r.departedAt}`;

/** "Rent", "Rent and Internet", "Rent, Internet and Water". */
function list(titles: string[]) {
  if (titles.length <= 1) return titles.join("");
  return `${titles.slice(0, -1).join(", ")} and ${titles[titles.length - 1]}`;
}

/**
 * House admin only: someone has left or been removed, and the house still
 * counts them in. Says exactly where, and goes away by itself once it's all
 * sorted (the list is worked out from the data on every visit).
 */
export function DepartureReminders({
  houseId,
  viewerId,
  currency,
  payerNames,
  reminders,
}: {
  houseId: string;
  viewerId: string;
  currency: string;
  /** Current housemates' first names, to say who pays a bill. */
  payerNames: Record<string, string>;
  reminders: DepartureReminder[];
}) {
  // null until mounted: localStorage isn't there during SSR.
  const [hidden, setHidden] = useState<Set<string> | null>(null);

  useEffect(() => {
    const next = new Set<string>();
    for (const r of reminders) {
      try {
        if (localStorage.getItem(seenKey(houseId, r)) === "1") next.add(r.userId);
      } catch {
        /* storage blocked: just show it */
      }
    }
    setHidden(next);
  }, [houseId, reminders]);

  if (hidden === null) return null;
  const visible = reminders.filter((r) => !hidden.has(r.userId));
  if (visible.length === 0) return null;

  function dismiss(r: DepartureReminder) {
    try {
      localStorage.setItem(seenKey(houseId, r), "1");
    } catch {
      /* fine: it shows again next visit */
    }
    setHidden((prev) => new Set(prev ?? []).add(r.userId));
  }

  return (
    <div className="space-y-3">
      {visible.map((r) => {
        const name = r.name?.trim() || null;
        const first = name?.split(/\s+/)[0] ?? null;
        const mine = r.splitBills.filter((b) => b.payerId === viewerId);
        // Bills someone else still in the house pays: they have to update those.
        const byPayer = new Map<string, string[]>();
        for (const b of r.splitBills) {
          if (!b.payerId || b.payerId === viewerId || !payerNames[b.payerId]) continue;
          byPayer.set(b.payerId, [...(byPayer.get(b.payerId) ?? []), b.title]);
        }
        // Bills in their split whose payer has gone too: the new payer sorts it.
        const noPayer = r.splitBills.filter(
          (b) => b.payerId !== viewerId && (!b.payerId || !payerNames[b.payerId]),
        );
        const lines: string[] = [];
        if (mine.length)
          lines.push(`Update the split on ${list(mine.map((b) => b.title))}: it still includes ${first ?? "them"}.`);
        for (const [payer, titles] of byPayer)
          lines.push(`Ask ${payerNames[payer]} to update the split on ${list(titles)}.`);
        if (r.paidBills.length)
          lines.push(`${first ?? "They"} ${first ? "was" : "were"} paying ${list(r.paidBills.map((b) => b.title))}. Pick a new payer.`);
        else if (noPayer.length)
          lines.push(`${list(noPayer.map((b) => b.title))} needs a new payer, then a new split.`);
        if (r.unsettled >= 0.01)
          lines.push(`${formatMoney(r.unsettled, currency)} of expenses with ${first ?? "them"} isn't settled yet.`);
        const bills = r.splitBills.length > 0 || r.paidBills.length > 0;

        return (
          <section key={r.userId} className="card space-y-2 p-4" aria-label="Housemate left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {name ?? "A housemate"} {r.kind === "removed" ? "was removed" : "left the house"}
                </h2>
                <p className="mt-0.5 text-sm text-slate-500">
                  Their share of bills and expenses needs adjusting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismiss(r)}
                aria-label="Dismiss"
                className="-mr-1 -mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" aria-hidden="true">
                  <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <ul className="space-y-1 text-sm text-slate-700">
              {lines.map((l) => (
                <li key={l} className="flex gap-2">
                  <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-amber-500" />
                  <span>{l}</span>
                </li>
              ))}
            </ul>
            <div className="flex gap-2 pt-1">
              {bills && (
                <Link href="/bills" className="btn-secondary px-3 py-1.5 text-xs">
                  Go to bills
                </Link>
              )}
              {r.unsettled >= 0.01 && (
                <Link href="/expenses" className="btn-secondary px-3 py-1.5 text-xs">
                  Go to expenses
                </Link>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
