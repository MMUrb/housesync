"use client";

import { useState } from "react";

// One store's review column on the Acquisition tab. Dates arrive pre-formatted
// from the server so nothing locale-dependent renders during hydration.
export type ReviewView = {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  metaLabel: string; // "AmeliaH_22 · GBR · 2 days ago", built server-side
};

const INITIAL = 5;

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-xs tracking-widest text-amber-500" aria-label={`${rating} out of 5`}>
      {"★".repeat(rating)}
      <span className="text-slate-300 dark:text-white/20">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

export function ReviewColumn({
  store,
  tone,
  reviews,
  emptyText,
}: {
  store: string;
  tone: "ios" | "android";
  reviews: ReviewView[];
  emptyText: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? reviews : reviews.slice(0, INITIAL);

  return (
    <div className="card self-start p-0">
      <div className="flex items-center gap-3 border-b border-slate-100 p-4">
        <span
          className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold text-white ${
            tone === "ios" ? "bg-sky-600" : "bg-mint-600"
          }`}
        >
          {tone === "ios" ? "iOS" : "AND"}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900">{store}</p>
          <p className="text-xs text-slate-400">
            {reviews.length === 0
              ? "No written reviews yet"
              : `${reviews.length} written review${reviews.length === 1 ? "" : "s"} · newest first`}
          </p>
        </div>
      </div>

      {reviews.length === 0 ? (
        <p className="p-4 text-sm text-slate-400">{emptyText}</p>
      ) : (
        <>
          <div className="divide-y divide-slate-50">
            {visible.map((r) => (
              <div key={r.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars rating={r.rating} />
                  {r.title && (
                    <span className="text-sm font-semibold text-slate-900">{r.title}</span>
                  )}
                </div>
                {r.body && (
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
                    {r.body}
                  </p>
                )}
                <p className="text-[11px] text-slate-400">{r.metaLabel}</p>
              </div>
            ))}
          </div>
          {reviews.length > INITIAL && (
            <div className="border-t border-slate-100 p-3 text-center">
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="text-xs font-medium text-brand-600 hover:underline"
              >
                {expanded ? `Show latest ${INITIAL}` : `Show all ${reviews.length}`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
