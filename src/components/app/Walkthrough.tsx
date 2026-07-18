"use client";

import { useCallback, useEffect, useState } from "react";

// First-run tour. Shows once per device (localStorage), and can be replayed any
// time from Settings, which dispatches the "hs:open-tour" event this listens for.
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
  }, []);

  if (!open) return null;

  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
    >
      <div className="card w-full max-w-sm p-6 text-center">
        <div className="text-5xl" aria-hidden="true">
          {slide.emoji}
        </div>
        <h2 className="mt-4 text-lg font-bold text-slate-900">{slide.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">{slide.body}</p>

        <div className="mt-5 flex items-center justify-center gap-1.5">
          {SLIDES.map((_, n) => (
            <span
              key={n}
              className={`h-1.5 rounded-full transition-all ${
                n === i ? "w-4 bg-brand-600" : "w-1.5 bg-slate-300"
              }`}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center gap-2">
          {i > 0 && (
            <button type="button" onClick={() => setI((n) => n - 1)} className="btn-secondary flex-1">
              Back
            </button>
          )}
          <button
            type="button"
            onClick={() => (last ? close() : setI((n) => n + 1))}
            className="btn-primary flex-1"
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>

        {!last && (
          <button
            type="button"
            onClick={close}
            className="mt-3 text-xs font-medium text-slate-400 transition hover:text-slate-600"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
