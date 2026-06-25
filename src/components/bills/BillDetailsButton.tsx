"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";

export function BillDetailsButton({
  title,
  amount,
  currency,
  emoji,
  categoryName,
  frequency,
  nextDue,
  paidByName,
  reminderEnabled,
  memberCount,
  perShare,
}: {
  title: string;
  amount: number;
  currency: string;
  emoji: string;
  categoryName: string;
  frequency: string;
  nextDue: string | null;
  paidByName: string;
  reminderEnabled: boolean;
  memberCount: number;
  perShare: number;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 text-xs font-medium text-brand-600 hover:underline"
      >
        View details
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="card max-h-[88vh] w-full max-w-md overflow-y-auto rounded-b-none rounded-t-2xl p-5 sm:rounded-2xl"
            onClick={(ev) => ev.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-xl">
                {emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-semibold text-slate-900">{title}</p>
                <p className="text-xs text-slate-500">{categoryName}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-xl leading-none text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
              >
                ×
              </button>
            </div>

            <div className="mt-4">
              <p className="text-3xl font-bold text-slate-900">{formatMoney(amount, currency)}</p>
              <p className="mt-1 text-sm capitalize text-slate-500">{frequency}</p>
            </div>

            <dl className="mt-4 space-y-2.5 border-t border-slate-100 pt-3 text-sm">
              <Row label="Per person">
                {formatMoney(perShare, currency)}, split {memberCount}{" "}
                {memberCount === 1 ? "way" : "ways"}
              </Row>
              <Row label="Next due">
                {nextDue
                  ? formatDate(nextDue, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
                  : "Not scheduled"}
              </Row>
              <Row label="Usually paid by">{paidByName}</Row>
              <Row label="Reminders">{reminderEnabled ? "On" : "Off"}</Row>
            </dl>
          </div>
        </div>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-800">{children}</dd>
    </div>
  );
}
