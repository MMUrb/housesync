import { isSupabaseConfigured } from "@/lib/env";
import { NotConfigured } from "@/components/NotConfigured";
import { getMyHouses, getProfile, requireHouse } from "@/lib/data";
import { AppHeader } from "@/components/app/AppHeader";
import { BottomNav } from "@/components/app/BottomNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) return <NotConfigured />;

  // Ensures the user is signed in and has a house (redirects otherwise).
  const { house } = await requireHouse();
  const [houses, profile] = await Promise.all([getMyHouses(), getProfile()]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col">
      <AppHeader house={house} houses={houses} profile={profile} />
      <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
