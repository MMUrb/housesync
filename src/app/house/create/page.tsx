import { requireUser } from "@/lib/data";
import { CreateHouseForm } from "@/components/house/CreateHouseForm";
import { HomeLogoLink } from "@/components/HomeLogoLink";
import { BackHomeButton } from "@/components/BackHomeButton";

export const metadata = { title: "Create your house" };

export default async function CreateHousePage() {
  const user = await requireUser();

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <HomeLogoLink logoClassName="text-lg" />
        <BackHomeButton />
      </div>

      {/* One question at a time; joining by code lives behind the link inside. */}
      <div className="mt-6 flex-1">
        <CreateHouseForm />
      </div>

      <div className="mt-10 flex flex-wrap items-center justify-center gap-1.5 text-center text-xs text-slate-400">
        <span className="truncate">Signed in as {user.email}.</span>
        <form action="/auth/signout" method="post">
          <button type="submit" className="font-medium text-brand-600 hover:underline">
            Sign out / use another account
          </button>
        </form>
      </div>
    </main>
  );
}
