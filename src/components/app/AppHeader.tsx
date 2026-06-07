import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { HouseSwitcher } from "@/components/app/HouseSwitcher";
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
    <div className="flex items-center justify-between px-4 py-3">
      <HouseSwitcher current={house} houses={houses} />
      <Link
        href="/settings"
        aria-label="Your profile and settings"
        className="shrink-0 rounded-full transition hover:opacity-90"
      >
        <Avatar name={profile?.name} color={profile?.avatar_color} avatarUrl={profile?.avatar_url} size="md" />
      </Link>
    </div>
  );
}
