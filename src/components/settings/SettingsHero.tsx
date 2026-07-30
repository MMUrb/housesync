"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { IconChevronDown } from "@/components/icons";

// The identity block at the top of Settings: who you are at a glance, and the
// only tinted card on the page so it reads as the anchor. Tapping it unfolds
// the profile editor (passed as children) in place.
export function SettingsHero({
  name,
  email,
  color,
  avatarUrl,
  isOwner,
  houseCount,
  children,
}: {
  name: string;
  email: string;
  color: string;
  avatarUrl: string | null;
  isOwner: boolean;
  houseCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="card flex w-full items-center gap-4 border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4 text-left transition touch-manipulation active:opacity-90 dark:border-white/10 dark:from-brand-500/15 dark:to-transparent"
      >
        <span
          className="relative shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#15152b]"
          style={{ ["--tw-ring-color" as string]: color }}
        >
          <Avatar name={name} color={color} avatarUrl={avatarUrl} size="xl" />
          <span className="absolute -bottom-0.5 -right-0.5 grid h-5 w-5 place-items-center rounded-full bg-brand-600 text-white ring-2 ring-white dark:ring-[#15152b]">
            <svg
              viewBox="0 0 24 24"
              className="h-2.5 w-2.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M4 20h4L19 9l-4-4L4 16z" />
            </svg>
          </span>
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-bold tracking-tight text-slate-900">
            {name || "Add your name"}
          </span>
          <span className="block truncate text-xs text-slate-500">{email}</span>
          <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {isOwner && <span className="chip bg-mint-50 text-[10px] text-mint-600">✓ Owner</span>}
            <span className="chip bg-slate-100 text-[10px] text-slate-500">
              {houseCount === 1 ? "1 house" : `${houseCount} houses`}
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-brand-600">
          {open ? "Close" : "Edit"}
          <IconChevronDown
            className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`}
          />
        </span>
      </button>

      {/* hidden (not unmounted) so a half-typed name survives closing the hero */}
      <div hidden={!open} className="mt-2">
        {children}
      </div>
    </div>
  );
}
