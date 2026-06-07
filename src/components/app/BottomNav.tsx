"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconBroom,
  IconHome,
  IconReceipt,
  IconRepeat,
  IconUsers,
} from "@/components/icons";

const ITEMS = [
  { href: "/dashboard", label: "Home", Icon: IconHome },
  { href: "/expenses", label: "Expenses", Icon: IconReceipt },
  { href: "/bills", label: "Bills", Icon: IconRepeat },
  { href: "/chores", label: "Chores", Icon: IconBroom },
  { href: "/housemates", label: "House", Icon: IconUsers },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-brand-600" : "text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className={`h-6 w-6 ${active ? "stroke-[2]" : ""}`} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
