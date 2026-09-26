"use client";

import { useEffect, useState } from "react";
import { formatMoney, ordinalDay } from "@/lib/format";

// Written by set-up right before it lands the user on the dashboard; read
// once and cleared, so a refresh or a later visit never replays the pop-up.
export const RENT_POPUP_KEY = "hs_rent_popup";

type Payload = { amount: number; day: number; currency: string };

/**
 * The one-time "Rent's set up" pop-up after creating a house with a rent
 * amount. Says exactly what happened (a monthly bill, down as the creator)
 * and what stays manual: splitting it when housemates join.
 */
export function RentSetupPopup() {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(RENT_POPUP_KEY);
      if (!raw) return;
      sessionStorage.removeItem(RENT_POPUP_KEY);
      const parsed = JSON.parse(raw) as Payload;
      if (parsed && Number(parsed.amount) > 0 && Number(parsed.day) >= 1) {
        setData({
          amount: Number(parsed.amount),
          day: Number(parsed.day),
          currency: typeof parsed.currency === "string" ? parsed.currency : "GBP",
        });
      }
    } catch {
      // No pop-up is fine.
    }
  }, []);

  useEffect(() => {
    if (!data) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setData(null);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
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
