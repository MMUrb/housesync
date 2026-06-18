import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getChatUnread, getMyHouses, getProfile, requireHouse } from "@/lib/data";
import { AppHeader } from "@/components/app/AppHeader";
import { TopNav } from "@/components/app/TopNav";
import { FollowUs } from "@/components/SocialLinks";
import { PushInit } from "@/components/push/PushInit";
import { HouseRealtime } from "@/components/app/HouseRealtime";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  // Ensures the user is signed in and has a house (redirects otherwise).
  const { user, house } = await requireHouse();
  const [houses, profile, chatUnread] = await Promise.all([
    getMyHouses(),
    getProfile(),
    getChatUnread(house.id, user.id),
  ]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* Sticky top bar: house switcher + profile, then the main nav tabs. */}
      <div className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-[var(--background)]/90 backdrop-blur">
        <AppHeader house={house} houses={houses} profile={profile} />
        <TopNav houseId={house.id} userId={user.id} initialUnread={chatUnread} />
      </div>
      <main className="flex-1 px-4 pb-8 pt-4">{children}</main>
      <PushInit />
      <HouseRealtime houseId={house.id} />
      <footer className="border-t border-slate-100 px-4 pt-3 [padding-bottom:calc(0.75rem_+_env(safe-area-inset-bottom))]">
        <div className="flex flex-col items-center gap-1.5">
          <FollowUs />
          <Link
            href="/privacy"
            className="text-[11px] text-slate-400 transition hover:text-slate-600"
          >
            Privacy Policy
          </Link>
        </div>
      </footer>
    </div>
  );
}
