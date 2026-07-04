"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Expenses + Bills are one "Money" section now (they share the Money nav tab),
// so both pages show this switch at the top to move between them.
const TABS = [
  { href: "/expenses", label: "Expenses" },
  { href: "/bills", label: "Bills" },
];

export function MoneyTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-4 flex rounded-xl bg-slate-100 p-1 text-sm font-semibold dark:bg-white/[0.06]">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 rounded-lg py-1.5 text-center transition ${
              active ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]" : "text-slate-500"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
