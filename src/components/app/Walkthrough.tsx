"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";

// First-run tour. Shows once per device (localStorage), and can be replayed any
// time from Settings, which dispatches the "hs:open-tour" event this listens for.
//
// A bottom sheet like the other launch sheets: full width, flush with the
// bottom edge and clear of the iPhone home indicator, centred on wider
// screens. Every slide is laid out in the same grid cell, so the sheet takes
// the tallest slide's height and never jumps between slides; the buttons are
// always the same pair (Back, Next) with Skip in the corner until the end.
const TOUR_KEY = "hs_tour_v1";

const SLIDES: { emoji: string; title: string; body: string }[] = [
  {
    emoji: "👋",
    title: "Welcome to HouseSync",
    body: "The easy way to share a house: split the bills, run the chore rota and keep rent sorted, all in one place.",
  },
  {
    emoji: "🧾",
    title: "Add & split expenses",
    body: "Log what you spend and split it equally, by custom amounts or by percentage. HouseSync keeps track of who owes who.",
  },
  {
    emoji: "🔁",
    title: "Bills & chores, sorted",
    body: "Set recurring bills with reminders, and a chore rota that rotates to the next housemate automatically.",
  },
  {
    emoji: "🤝",
    title: "Settle up, minus the awkward",
    body: "See balances at a glance and settle with a tap. HouseSync even writes the polite reminder for you.",
  },
];

export function Walkthrough() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(TOUR_KEY) !== "done") setOpen(true);
    } catch {
      /* localStorage blocked — just skip the tour */
    }
    const onOpen = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("hs:open-tour", onOpen);
    return () => window.removeEventListener("hs:open-tour", onOpen);
  }, []);

  const close = useCallback(() => {
    try {
      localStorage.setItem(TOUR_KEY, "done");
    } catch {
      /* ignore */
    }
    setOpen(false);
    // The notifications ask waits for the tour to finish before it appears.
    window.dispatchEvent(new CustomEvent("hs:tour-done"));
  }, []);

  // While open: the page behind stays still, focus moves into the sheet, and
  // Escape or Android back skip the tour rather than navigating behind it.
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(close);
    panelRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
    };
  }, [open, close]);

  if (!open) return null;

  const last = i === SLIDES.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <div className="absolute inset-0 bg-slate-900/55" aria-hidden="true" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="hs-sheet-up card relative w-full max-w-md rounded-b-none rounded-t-3xl px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center outline-none sm:rounded-3xl sm:pb-6"
      >
        <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        {!last && (
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-400 transition hover:text-slate-600"
          >
            Skip
          </button>
        )}

        <div className="grid">
          {SLIDES.map((s, n) => (
            <div
              key={s.title}
              className={`[grid-area:1/1] ${n === i ? "" : "invisible"}`}
              aria-hidden={n !== i}
            >
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-[34px] leading-none">
                <span aria-hidden="true">{s.emoji}</span>
              </div>
              <h2 className="mt-4 text-xl font-bold tracking-tight text-slate-900">{s.title}</h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
          {SLIDES.map((s, n) => (
            <span
              key={s.title}
              className={`h-1.5 rounded-full transition-all ${n === i ? "w-5 bg-brand-600" : "w-1.5 bg-slate-200"}`}
            />
          ))}
        </div>
        <p className="sr-only" aria-live="polite">
          Step {i + 1} of {SLIDES.length}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setI((n) => Math.max(0, n - 1))}
            disabled={i === 0}
            className="btn-secondary py-3 disabled:opacity-40"
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => (last ? close() : setI((n) => n + 1))}
            className="btn-primary py-3"
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}
