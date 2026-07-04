import type { Metadata } from "next";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/env";

// The signed-in app is private user data — never index it.
export const metadata: Metadata = { robots: { index: false, follow: false } };
import { NotConfigured } from "@/components/NotConfigured";
import { getChatUnreadCounts, getMyHouses, getProfile, requireHouse } from "@/lib/data";
import { AppHeader } from "@/components/app/AppHeader";
import { TopNav } from "@/components/app/TopNav";
import { FollowUs } from "@/components/SocialLinks";
import { PushInit } from "@/components/push/PushInit";
import { NativeShell } from "@/components/app/NativeShell";
import { HouseRealtime } from "@/components/app/HouseRealtime";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  // Ensures the user is signed in and has a house (redirects otherwise).
  const { user, house } = await requireHouse();
  const [houses, profile] = await Promise.all([getMyHouses(), getProfile()]);
  // One pass over every house the user is in powers both the Chat-tab badge
  // (active house) and the per-house badges in the switcher.
  const unreadByHouse = await getChatUnreadCounts(
    houses.map((h) => h.id),
    user.id,
  );
  const chatUnread = unreadByHouse[house.id] ?? 0;

  return (
    <div className="app-shell mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* Sticky top bar: house switcher + profile, then the main nav tabs. */}
      <div
        data-app-header
        className="safe-top sticky top-0 z-30 border-b border-slate-200 bg-[var(--background)]/90 backdrop-blur"
      >
        <AppHeader
          house={house}
          houses={houses}
          profile={profile}
          userId={user.id}
          unreadByHouse={unreadByHouse}
        />
        <TopNav houseId={house.id} userId={user.id} initialUnreadCount={chatUnread} />
      </div>
      <main className="flex-1 px-4 pb-8 pt-4">{children}</main>
      <PushInit />
      <NativeShell />
      <HouseRealtime houseId={house.id} />
      <footer
        data-app-footer
        className="border-t border-slate-100 px-4 pt-3 [padding-bottom:calc(0.75rem_+_env(safe-area-inset-bottom))]"
      >
        <div className="flex flex-col items-center gap-1.5">
          <FollowUs />
          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Link href="/privacy" className="transition hover:text-slate-600">
              Privacy Policy
            </Link>
            <span>·</span>
            <Link href="/terms" className="transition hover:text-slate-600">
              Terms of Use
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
