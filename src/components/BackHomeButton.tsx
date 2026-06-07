"use client";

import Link from "next/link";
import { confirmLeave } from "@/lib/leaveGuard";

/** An obvious labelled way back to the home page (respects the leave guard). */
export function BackHomeButton({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      onClick={(e) => {
        if (!confirmLeave()) e.preventDefault();
      }}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${className}`}
    >
      <span aria-hidden>←</span> Home
    </Link>
  );
}
