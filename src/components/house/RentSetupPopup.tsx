"use client";

import { useEffect, useState } from "react";
import { formatMoney, ordinalDay } from "@/lib/format";
import {
  RENT_POPUP_KEY,
  afterTour,
  lockScroll,
  onHardwareBack,
  setRentPopupOpen,
} from "@/lib/launchPrompts";

type Payload = { amount: number; day: number; currency: string };

/**
 * The one-time "Rent's set up" pop-up after creating a house with a rent
 * amount. Says exactly what happened (a monthly bill, down as the creator)
 * and what stays manual: splitting it when housemates join.
 *
 * Plays by the launch-prompt queue rules: it waits for the first-run tour
 * (the key stays in sessionStorage until then, so quitting mid-tour just
 * defers it to the next visit), and the notifications ask waits for it via
 * afterRentPopup(). The key is read once and cleared, so a refresh or a
 * later visit never replays it.
 */
export function RentSetupPopup() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    let cancelled = false;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(RENT_POPUP_KEY);
    } catch {
      return; // No pop-up is fine.
    }
    if (!raw) return;

    const consume = () => {
      let parsed: Payload | null = null;
      try {
        const p = JSON.parse(raw as string) as Payload;
        if (p && Number(p.amount) > 0 && Number(p.day) >= 1) {
          parsed = {
            amount: Number(p.amount),
            day: Number(p.day),
            currency: typeof p.currency === "string" ? p.currency : "GBP",
          };
        }
      } catch {
        /* bad payload: nothing to show */
      }
      // Flag first, then clear the key: a waiter checking in between must
      // still see the pop-up as pending.
      if (parsed && !cancelled) setRentPopupOpen(true);
      try {
        sessionStorage.removeItem(RENT_POPUP_KEY);
      } catch {
        /* fine */
      }
      if (parsed && !cancelled) setData(parsed);
      else setRentPopupOpen(false); // releases anyone waiting on the key
    };

    const tour = afterTour();
    void tour.promise.then(() => {
      if (!cancelled) consume();
    });
    return () => {
      cancelled = true;
      tour.cancel();
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(() => setData(null));
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setData(null);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
      setRentPopupOpen(false);
    };
  }, [data]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
      onClick={() => setData(null)}
      role="dialog"
      aria-modal="true"
      aria-label="Rent is set up"
    >
      <div
        className="card w-full max-w-sm p-6 text-center"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-3xl">
          🏠
        </div>
        <h2 className="mt-3 text-lg font-bold text-slate-900">Rent&rsquo;s set up</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          <b>
            {formatMoney(data.amount, data.currency)} on the {ordinalDay(data.day)} of every month
          </b>{" "}
          now lives in your Money tab, down as yours for now. When your housemates join, open it
          and split it between you, your call, your numbers.
        </p>
        <button type="button" onClick={() => setData(null)} className="btn-primary btn-block mt-5">
          Got it
        </button>
      </div>
    </div>
  );
}
