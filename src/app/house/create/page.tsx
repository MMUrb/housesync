import Link from "next/link";
import { requireUser, getMyHouses } from "@/lib/data";
import { CreateHouseForm } from "@/components/house/CreateHouseForm";
import { JoinByCode } from "@/components/house/JoinByCode";
import { Logo } from "@/components/Logo";

export const metadata = { title: "Create your house" };

export default async function CreateHousePage() {
  const user = await requireUser();
  const houses = await getMyHouses();
  const hasHouse = houses.length > 0;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <Logo className="text-lg" />
        {hasHouse && (
          <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-800">
            Back
          </Link>
        )}
      </div>

      <div className="mt-8">
        <h1 className="text-2xl font-bold text-slate-900">Create your house</h1>
        <p className="mt-1.5 text-sm text-slate-600">
          Set it up once, then invite your housemates. You can change these later.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          <span className="truncate">Signed in as {user.email}.</span>
          <form action="/auth/signout" method="post">
            <button type="submit" className="font-medium text-brand-600 hover:underline">
              Sign out / use another account
            </button>
          </form>
        </div>
      </div>

      <div className="mt-6">
        <CreateHouseForm />
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" />
        or join an existing house
        <span className="h-px flex-1 bg-slate-200" />
      </div>

      <JoinByCode />
    </main>
  );
}
