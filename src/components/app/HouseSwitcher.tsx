"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { setActiveHouse } from "@/lib/activeHouse";
import { IconChevronDown, IconCheck, IconPlus } from "@/components/icons";
import type { House } from "@/lib/types";

export function HouseSwitcher({
  current,
  houses,
}: {
  current: House;
  houses: House[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function choose(id: string) {
    setOpen(false);
    if (id === current.id) return;
    setActiveHouse(id);
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex max-w-[60vw] items-center gap-1 rounded-lg px-1.5 py-1 text-left hover:bg-slate-100 dark:hover:bg-white/[0.06]"
      >
        <span className="truncate text-lg font-bold text-slate-900">{current.name}</span>
        <IconChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft dark:border-white/10 dark:bg-[#15152b]">
          <p className="px-3 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Your houses
          </p>
          <ul className="py-1">
            {houses.map((h) => (
              <li key={h.id}>
                <button
                  onClick={() => choose(h.id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-white/[0.06] ${
                    h.id === current.id ? "bg-slate-50 dark:bg-white/[0.04]" : ""
                  }`}
                >
                  <span className="truncate text-slate-800">{h.name}</span>
                  {h.id === current.id && <IconCheck className="h-4 w-4 text-brand-600" />}
                </button>
              </li>
            ))}
          </ul>
          <Link
            href="/house/create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5 text-sm font-medium text-brand-600 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/[0.06]"
          >
            <IconPlus className="h-4 w-4" />
            Create or join another house
          </Link>
        </div>
      )}
    </div>
  );
}
