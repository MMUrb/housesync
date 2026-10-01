import { getMyHouses, requireUser } from "@/lib/data";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { joinPromptDue } from "@/lib/joinPrompt";
import { CreateHouseForm } from "@/components/house/CreateHouseForm";
import { HomeLogoLink } from "@/components/HomeLogoLink";
import { BackHomeButton } from "@/components/BackHomeButton";
import { SignOutLink } from "@/components/auth/SignOutLink";

export const metadata = { title: "Create your house" };

/**
 * When this person last left (or was removed from) a house. Departures are
 * readable only by house admins, so the server reads their own with the
 * service role; nothing but a yes/no about the prompt reaches the page.
 * null = never left; undefined = couldn't tell (the prompt then stays away).
 */
async function lastDepartedAt(userId: string): Promise<string | null | undefined> {
  if (!isAdminConfigured) return undefined;
  try {
    const { data, error } = await createAdminClient()
      .from("house_departures")
      .select("departed_at")
      .eq("user_id", userId)
      .order("departed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return undefined;
    return (data?.departed_at as string | undefined) ?? null;
  } catch {
    return undefined;
  }
}

export default async function CreateHousePage() {
  const user = await requireUser();

  // Someone in no house at all for a few days is asked whether they meant to
  // join housemates who already use HouseSync. Never straight away, and never
  // when they're here to start a second house.
  let joinPromptFor: string | undefined;
  if ((await getMyHouses()).length === 0) {
    const departed = await lastDepartedAt(user.id);
    if (departed !== undefined && joinPromptDue(user.created_at, departed, Date.now())) {
      joinPromptFor = user.id;
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <HomeLogoLink logoClassName="text-lg" />
        <BackHomeButton />
      </div>

      {/* One question at a time; joining by code lives behind the link inside. */}
      <div className="mt-6 flex-1">
        <CreateHouseForm joinPromptFor={joinPromptFor} />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <span className="truncate">Signed in as {user.email}.</span>
        <SignOutLink label="Sign out / use another account" />
      </div>
    </main>
  );
}
