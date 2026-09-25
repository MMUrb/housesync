"use client";

import Link from "next/link";

export type StarterTemplate = { title: string; category: string; emoji: string };

/**
 * The first-expense starter card on the dashboard. "fresh" leads the page
 * while the house has housemates but no expenses; "follow" is the slimmer
 * nudge after the first ones land, offering only the templates not yet used.
 * It retires for good once the house has a few expenses.
 */
export function StarterTemplates({
  templates,
  memberCount,
  variant,
}: {
  templates: StarterTemplate[];
  memberCount: number;
  variant: "fresh" | "follow";
}) {
  if (templates.length === 0) return null;

  const chips = (
    <div className="flex flex-wrap gap-2">
      {templates.map((t) => (
        <Link
          key={t.title}
          href={`/expenses/new?title=${encodeURIComponent(t.title)}&category=${encodeURIComponent(t.category)}`}
          className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <span aria-hidden="true">{t.emoji}</span>
          {t.title}
        </Link>
      ))}
    </div>
  );

  if (variant === "follow") {
    return (
      <section className="card space-y-2.5 p-4">
        <p className="text-[13px] font-bold text-slate-700">
          🎉 That&apos;s the house live. A couple more taps finish the set-up:
        </p>
        {chips}
      </section>
    );
  }

  return (
    <section className="card space-y-3 p-4">
      <div>
        <h2 className="text-[15px] font-extrabold text-slate-900">Add your first shared cost</h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Tap one and it&apos;s ready to go: split equally between all {memberCount} of you, just
          add the amount.
        </p>
      </div>
      {chips}
      <Link
        href="/expenses/new"
        className="block text-center text-xs font-bold text-brand-600 hover:underline"
      >
        or start from scratch
      </Link>
    </section>
  );
}
