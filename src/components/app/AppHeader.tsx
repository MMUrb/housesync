import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HouseSwitcher } from "@/components/app/HouseSwitcher";
import { ThemeIconButton } from "@/components/ThemeIconButton";
import type { House, Profile } from "@/lib/types";

export function AppHeader({
  house,
  houses,
  profile,
  userId,
  unreadByHouse,
}: {
  house: House;
  houses: House[];
  profile: Profile | null;
  userId: string;
  unreadByHouse: Record<string, number>;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <HouseSwitcher
        current={house}
        houses={houses}
        userId={userId}
        unreadByHouse={unreadByHouse}
      />
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/search"
          aria-label="Search this house"
          className="grid h-9 w-9 place-items-center rounded-full text-slate-600 transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            className="h-5 w-5"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.6-3.6" />
          </svg>
        </Link>
        <ThemeIconButton />
        <Link
          href="/settings"
          aria-label="Your profile and settings"
          className="shrink-0 rounded-full transition hover:opacity-90"
        >
          <Avatar name={profile?.name} color={profile?.avatar_color} avatarUrl={profile?.avatar_url} size="md" />
        </Link>
      </div>
    </div>
  );
}
