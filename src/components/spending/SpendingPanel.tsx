"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { buildCatLookup } from "@/lib/categories";

export type SpendExpense = { id: string; amount: number; category: string; date: string };
export type SpendSplit = { expense_id: string; user_id: string; amount_owed: number };
export type SpendMember = { id: string; name: string; color: string };
export type SpendCategory = { code: string; name: string; emoji: string; color: string };

type Period = "month" | "week" | "custom";
const DAY = 86_400_000;
const dateMs = (d: string) => new Date(`${d}T00:00:00`).getTime();

type Bucket = { label: string; start: number; end: number };

function monthBuckets(n: number): Bucket[] {
  const now = new Date();
  const out: Bucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const e = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    out.push({ label: s.toLocaleString("en-GB", { month: "short" }), start: s.getTime(), end: e.getTime() });
  }
  return out;
}

function weekBuckets(n: number): Bucket[] {
  const todayMid = new Date(new Date().toDateString()).getTime();
  const out: Bucket[] = [];
  for (let j = 0; j < n; j++) {
    const end = todayMid + DAY - (n - 1 - j) * 7 * DAY;
    const start = end - 7 * DAY;
    out.push({
      label: new Date(start).toLocaleString("en-GB", { day: "numeric", month: "short" }),
      start,
      end,
    });
  }
  return out;
}

function customBuckets(from: string, to: string): Bucket[] {
  let start = from ? dateMs(from) : Date.now() - 30 * DAY;
  let end = (to ? dateMs(to) : Date.now()) + DAY;
  if (end <= start) [start, end] = [end - DAY, start + DAY];
  const spanDays = Math.max(1, Math.round((end - start) / DAY));
  const out: Bucket[] = [];
  if (spanDays <= 31) {
    for (let t = start; t < end; t += DAY) {
      out.push({
        label: new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short" }),
        start: t,
        end: t + DAY,
      });
    }
  } else {
    for (let t = start; t < end; t += 7 * DAY) {
      out.push({
        label: new Date(t).toLocaleString("en-GB", { day: "numeric", month: "short" }),
        start: t,
        end: Math.min(t + 7 * DAY, end),
      });
    }
  }
  return out;
}

export function SpendingPanel({
  expenses,
  splits,
  members,
  categories,
  meId,
  currency,
}: {
  expenses: SpendExpense[];
  splits: SpendSplit[];
  members: SpendMember[];
  categories: SpendCategory[];
  meId: string;
  currency: string;
}) {
  const lookup = useMemo(() => buildCatLookup(categories), [categories]);
  const scopes = useMemo(
    () => [
      { key: "house", label: "Whole house", color: "#6f53f5" },
      ...members
        .slice()
        .sort((a) => (a.id === meId ? -1 : 0))
        .map((m) => ({ key: m.id, label: m.id === meId ? "You" : m.name, color: m.color })),
    ],
    [members, meId],
  );

  const [scopeIdx, setScopeIdx] = useState(scopes.findIndex((s) => s.key === meId) >= 0 ? 1 : 0);
  const [period, setPeriod] = useState<Period>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const scope = scopes[Math.min(scopeIdx, scopes.length - 1)];

  // Per-(expense, user) share lookup for fast person scoping.
  const shareOf = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of splits) {
      const k = `${s.expense_id}:${s.user_id}`;
      m.set(k, (m.get(k) ?? 0) + Number(s.amount_owed));
    }
    return m;
  }, [splits]);

  const amountFor = (e: SpendExpense): number =>
    scope.key === "house" ? Number(e.amount) : shareOf.get(`${e.id}:${scope.key}`) ?? 0;

  const buckets = useMemo<Bucket[]>(() => {
    if (period === "month") return monthBuckets(6);
    if (period === "week") return weekBuckets(8);
    return customBuckets(from, to);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, from, to]);

  // Series + category breakdown for the visible window.
  const { series, total, max, cats } = useMemo(() => {
    const series = buckets.map((b) => ({ label: b.label, total: 0 }));
    const byCat: Record<string, number> = {};
    const wStart = buckets[0]?.start ?? 0;
    const wEnd = buckets[buckets.length - 1]?.end ?? Date.now();
    for (const e of expenses) {
      const t = dateMs(e.date);
      if (t < wStart || t >= wEnd) continue;
      const amt = amountFor(e);
      if (amt === 0) continue;
      const bi = buckets.findIndex((b) => t >= b.start && t < b.end);
      if (bi >= 0) series[bi].total += amt;
      byCat[e.category] = (byCat[e.category] ?? 0) + amt;
    }
    const total = series.reduce((s, x) => s + x.total, 0);
    const max = Math.max(0.01, ...series.map((s) => s.total));
    const cats = Object.entries(byCat)
      .map(([code, amount]) => {
        const m = lookup(code);
        return { code, amount, label: m.name, color: m.color };
      })
      .sort((a, b) => b.amount - a.amount);
    return { series, total, max, cats };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buckets, scopeIdx, expenses, splits]);

  const unit = period === "month" ? "month" : period === "week" ? "week" : "period";
  const insight = useMemo(() => {
    if (total === 0) return "Nothing tracked here yet. Add an expense to see the trend.";
    const last = series[series.length - 1]?.total ?? 0;
    const prev = series[series.length - 2]?.total ?? 0;
    let trend = "";
    if (prev > 0 && period !== "custom") {
      const pct = Math.round(((last - prev) / prev) * 100);
      if (Math.abs(pct) >= 3)
        trend = ` ${pct > 0 ? "Up" : "Down"} ${Math.abs(pct)}% vs the previous ${unit}.`;
    }
    const top = cats[0];
    const topStr = top ? ` Biggest: ${top.label} (${formatMoney(top.amount, currency)}).` : "";
    const who = scope.key === "house" ? "The house has" : scope.label === "You" ? "You've" : `${scope.label} has`;
    return `${who} spent ${formatMoney(total, currency)}.${topStr}${trend}`;
  }, [series, total, cats, scope, unit, period, currency]);

  return (
    <div className="card p-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="relative inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1.5 pl-3 pr-7 text-sm font-semibold text-slate-700 dark:bg-white/[0.04]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: scope.color }} />
          <select
            value={scopeIdx}
            onChange={(e) => setScopeIdx(Number(e.target.value))}
            aria-label="Whose spending to show"
            className="cursor-pointer appearance-none bg-transparent font-semibold focus:outline-none"
          >
            {scopes.map((s, i) => (
              <option key={s.key} value={i} className="text-slate-900">
                {s.label}
              </option>
            ))}
          </select>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400"
          >
            <path d="M7 8l3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>

        <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold dark:bg-white/[0.06]">
          {(["week", "month", "custom"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`rounded-md px-2.5 py-1 capitalize transition ${
                period === p ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]" : "text-slate-500"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {period === "custom" && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input py-1.5 text-xs" />
          <span>to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input py-1.5 text-xs" />
        </div>
      )}

      {/* Total */}
      <div className="mt-4">
        <p className="text-2xl font-bold text-slate-900">{formatMoney(total, currency)}</p>
        <p className="text-xs text-slate-500">
          {scope.label} · last {buckets.length} {unit === "period" ? "buckets" : `${unit}s`}
        </p>
      </div>

      {/* Trend bars */}
      <div className="mt-3 flex h-28 items-end justify-between gap-1">
        {series.map((s, i) => (
          <div key={i} className="flex h-full flex-1 items-end" title={`${s.label}: ${formatMoney(s.total, currency)}`}>
            <div
              className="w-full rounded-t bg-brand-500"
              style={{ height: `${Math.max(2, (s.total / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between">
        {series.map((s, i) => (
          <span key={i} className="flex-1 text-center text-[9px] text-slate-400">
            {series.length > 9 && i % 2 ? "" : s.label}
          </span>
        ))}
      </div>

      {/* Auto insight */}
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-white/[0.04]">
        💡 {insight}
      </p>

      {/* Category breakdown */}
      {cats.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {cats.slice(0, 6).map((c) => (
            <li key={c.code} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">{c.label}</span>
              <span className="text-xs text-slate-400">{Math.round((c.amount / total) * 100)}%</span>
              <span className="w-16 text-right font-medium text-slate-800">
                {formatMoney(c.amount, currency)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
