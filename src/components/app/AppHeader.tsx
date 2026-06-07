import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HouseSwitcher } from "@/components/app/HouseSwitcher";
import { IconCog } from "@/components/icons";
import type { House, Profile } from "@/lib/types";

export function AppHeader({
  house,
  houses,
  profile,
}: {
  house: House;
  houses: House[];
  profile: Profile | null;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-[var(--background)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <HouseSwitcher current={house} houses={houses} />
        <div className="flex items-center gap-1">
          <Link
            href="/settings"
            aria-label="Settings"
            className="grid h-9 w-9 place-items-center rounded-full text-slate-500 hover:bg-slate-100"
          >
            <IconCog className="h-5 w-5" />
          </Link>
          <Link href="/settings" aria-label="Your profile">
            <Avatar name={profile?.name} color={profile?.avatar_color} size="md" />
          </Link>
        </div>
      </div>
    </header>
  );
}
