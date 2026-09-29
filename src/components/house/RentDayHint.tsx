"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ordinalDay } from "@/lib/format";
import { showToast } from "@/components/app/Toast";

/**
 * The dashboard card for a house that has a rent day (set-up asks for one,
 * Settings keeps it) but no rent bill: rent is then neither tracked nor
 * reminded, and the day is only a label in Settings. It opens Add bill
 * already set up as monthly rent on that day, so only the amount is left to
 * type. Its corner x hides it on this device.
 */
export function RentDayHint({ houseId, rentDay }: { houseId: string; rentDay: number }) {
  // Per device and per house on purpose: it's a layout preference, like the
  // invite card's, and someone in two houses may want it in only one.
  const key = `hs_rent_hint_hidden::${houseId}`;
  // null until mounted: localStorage isn't there during SSR.
  const [hidden, setHidden] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(key) === "1");
    } catch {
      setHidden(false);
    }
  }, [key]);

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* fine: it just shows again next visit */
    }
    setHidden(true);
    showToast({ message: "You can add rent any time from Bills." });
  }

  if (hidden !== false) return null;

  return (
    <section className="card relative p-4">
      <button
        type="button"
        aria-label="Hide this. You can add rent any time from Bills."
        title="Hide this"
        onClick={dismiss}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="flex items-start gap-3 pr-8">
        <span
          aria-hidden="true"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-lg"
        >
          🏠
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            Rent is due on the {ordinalDay(rentDay)}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            It isn&apos;t tracked yet. Add the monthly amount and HouseSync reminds you before
            it&apos;s due, every month.
          </p>
        </div>
      </div>
      <Link href="/bills/new?preset=rent" className="btn-primary btn-block mt-3 text-sm">
        Add the rent amount
      </Link>
    </section>
  );
}
