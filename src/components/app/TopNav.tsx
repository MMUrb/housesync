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

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-slate-100">
      <div className="mx-auto flex max-w-2xl items-stretch justify-around">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-1 flex-col items-center gap-0.5 border-b-2 py-2 text-[11px] font-medium transition-colors ${
                active
                  ? "border-brand-600 text-brand-600"
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
