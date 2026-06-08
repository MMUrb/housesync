import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getMyHouses, getProfile, requireHouse } from "@/lib/data";
import { AppHeader } from "@/components/app/AppHeader";
import { TopNav } from "@/components/app/TopNav";
import { FollowUs } from "@/components/SocialLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  // Ensures the user is signed in and has a house (redirects otherwise).
  const { house } = await requireHouse();
  const [houses, profile] = await Promise.all([getMyHouses(), getProfile()]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      {/* Sticky top bar: house switcher + profile, then the main nav tabs. */}
      <div className="sticky top-0 z-30 border-b border-slate-200 bg-[var(--background)]/90 backdrop-blur">
        <AppHeader house={house} houses={houses} profile={profile} />
        <TopNav />
      </div>
      <main className="flex-1 px-4 pb-8 pt-4">{children}</main>
      <footer className="border-t border-slate-100 px-4 py-3.5">
        <FollowUs />
      </footer>
    </div>
  );
}
