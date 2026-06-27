import Link from "next/link";
import { getChores, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { ChoresList } from "@/components/chores/ChoresList";
import { IconPlus } from "@/components/icons";

export const metadata = { title: "Chores" };
export const dynamic = "force-dynamic";

// yyyy-mm-dd from a date's local parts (avoids the UTC shift toISOString can
// introduce near midnight).
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function ChoresPage() {
  const { user, house, members } = await requireHouse();
  const chores = await getChores(house.id);

  const now = new Date();
  const today = isoLocal(now);
  const week = new Date(now);
  week.setDate(now.getDate() + 7);
  const weekISO = isoLocal(week);
  const monthISO = isoLocal(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const hasAny = chores.length > 0;

  return (
    <div>
      <PageTitle
        title="Chores"
        subtitle="Keep the house running, together."
        action={
          <Link href="/chores/new" className="btn-primary px-3 py-2 text-sm">
            <IconPlus className="h-4 w-4" /> Add
          </Link>
        }
      />

      {!hasAny ? (
        <div className="card mt-2 flex flex-col items-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-amber-50 text-3xl">🧹</div>
          <h2 className="mt-3 font-semibold text-slate-900">No chores yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Add a rota for bins, cleaning and shared tasks. Repeating chores rotate between
            housemates automatically.
          </p>
          <Link href="/chores/new" className="btn-primary mt-5">
            Add your first chore
          </Link>
        </div>
      ) : (
        <ChoresList
          chores={chores}
          members={members}
          currentUserId={user.id}
          today={today}
          weekISO={weekISO}
          monthISO={monthISO}
        />
      )}
    </div>
  );
}
