"use client";

import { useEffect, useState } from "react";
import { formatMoney, formatDate } from "@/lib/format";
import { buildCatLookup } from "@/lib/categories";
import type { SplitStatus } from "@/lib/types";

type Cat = { code: string; name: string; emoji: string; color: string };

export interface ExpenseVM {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  paidByName: string;
  paidByYou: boolean;
  impactKind: "owe" | "owed" | "settled" | "none";
  impactAmount: number;
  settled: boolean;
  // Detail (shown when a row is tapped):
  splitType: string;
  notes: string | null;
  createdAt: string;
  receiptUrl: string | null;
  breakdown: { name: string; you: boolean; amount: number; status: SplitStatus }[];
}

const SPLIT_LABEL: Record<string, string> = {
  equal: "Split equally",
  custom: "Custom amounts",
  percentage: "Split by percentage",
};

export function ExpensesList({
  rows,
  currency,
  categories,
}: {
  rows: ExpenseVM[];
  currency: string;
  categories: Cat[];
}) {
  const lookup = buildCatLookup(categories);
  const [status, setStatus] = useState<"ongoing" | "settled">(
    rows.some((r) => !r.settled) ? "ongoing" : "settled",
  );
  const [cat, setCat] = useState<string>("all");
  const [selected, setSelected] = useState<ExpenseVM | null>(null);

  const ongoingCount = rows.filter((r) => !r.settled).length;
  const settledCount = rows.length - ongoingCount;

  const byStatus = rows.filter((r) => (status === "settled" ? r.settled : !r.settled));
  const filtered = cat === "all" ? byStatus : byStatus.filter((r) => r.category === cat);

  const tabs: string[] = [
    "all",
    ...categories.map((c) => c.code).filter((code) => byStatus.some((r) => r.category === code)),
  ];

  return (
    <div>
      <div className="mb-3 flex rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
        {(["ongoing", "settled"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setCat("all");
            }}
            className={`flex-1 rounded-md px-3 py-1.5 capitalize transition ${
              status === s
                ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
                : "text-slate-500"
            }`}
          >
            {s} ({s === "ongoing" ? ongoingCount : settledCount})
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setCat(t)}
            className={`chip shrink-0 border ${
              cat === t
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            {t === "all" ? "All" : `${lookup(t).emoji} ${lookup(t).name}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-6 text-center text-sm text-slate-500">
          {status === "ongoing"
            ? "Nothing ongoing here, all settled up 🎉"
            : "No settled expenses here yet."}
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {filtered.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setSelected(r)}
                className="flex w-full items-center gap-3 p-3.5 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">
                  {lookup(r.category).emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">{r.title}</p>
                  <p className="text-xs text-slate-500">
                    {r.paidByYou ? "You paid" : `${r.paidByName} paid`} · {formatDate(r.date)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-800">
                    {formatMoney(r.amount, currency)}
                  </p>
                  <p
                    className={`text-xs font-medium ${
                      r.impactKind === "owe"
                        ? "text-red-600"
                        : r.impactKind === "owed"
                          ? "text-mint-600"
                          : "text-slate-400"
                    }`}
                  >
                    {r.impactKind === "owe" && `you owe ${formatMoney(r.impactAmount, currency)}`}
                    {r.impactKind === "owed" && `you're owed ${formatMoney(r.impactAmount, currency)}`}
                    {r.impactKind === "settled" && "settled"}
                    {r.impactKind === "none" && "not involved"}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <ExpenseDetailSheet
          expense={selected}
          currency={currency}
          emoji={lookup(selected.category).emoji}
          categoryName={lookup(selected.category).name}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StatusPill({ status }: { status: SplitStatus }) {
  if (status === "confirmed") return <span className="chip bg-mint-50 text-mint-700">paid</span>;
  if (status === "paid") return <span className="chip bg-amber-50 text-amber-700">awaiting</span>;
  return <span className="chip bg-red-50 text-red-600">unpaid</span>;
}

function ExpenseDetailSheet({
  expense: e,
  currency,
  emoji,
  categoryName,
  onClose,
}: {
  expense: ExpenseVM;
  currency: string;
  emoji: string;
  categoryName: string;
  onClose: () => void;
}) {
  // Close on Escape, and lock background scroll while open.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4"
      onClick={onClose}
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
            <p className="truncate text-base font-semibold text-slate-900">{e.title}</p>
            <p className="text-xs text-slate-500">{categoryName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-xl leading-none text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06]"
          >
            ×
          </button>
        </div>

        <div className="mt-4">
          <p className="text-3xl font-bold text-slate-900">{formatMoney(e.amount, currency)}</p>
          <p className="mt-1 text-sm text-slate-500">
            {e.paidByYou ? "You paid" : `${e.paidByName} paid`} · {formatDate(e.date)} ·{" "}
            {SPLIT_LABEL[e.splitType] ?? "Split"}
          </p>
        </div>

        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Who owes what
          </p>
          <ul className="space-y-1.5">
            {e.breakdown.map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`min-w-0 flex-1 truncate ${b.you ? "font-medium text-slate-900" : "text-slate-700"}`}>
                  {b.name}
                </span>
                <span className="text-slate-500">{formatMoney(b.amount, currency)}</span>
                <StatusPill status={b.status} />
              </li>
            ))}
          </ul>
        </div>

        {e.notes && (
          <div className="mt-4 border-t border-slate-100 pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Note</p>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{e.notes}</p>
          </div>
        )}

        {e.receiptUrl && (
          <a
            href={e.receiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary btn-block mt-4 text-sm"
          >
            View receipt
          </a>
        )}

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Added {formatDate(e.createdAt, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>
    </div>
  );
}
