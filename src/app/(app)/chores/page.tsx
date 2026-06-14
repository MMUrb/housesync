import Link from "next/link";
import { getChores, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { ChoreItem } from "@/components/chores/ChoreItem";
import { IconPlus } from "@/components/icons";
import { todayISO } from "@/lib/recurrence";
import type { Chore } from "@/lib/types";

export const metadata = { title: "Chores" };
export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const { user, house, members } = await requireHouse();
  const chores = await getChores(house.id);

  const today = todayISO();
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const weekISO = weekAhead.toISOString().slice(0, 10);

  const todo = chores.filter((c) => c.status === "todo");
  const groups: { label: string; items: Chore[] }[] = [
    { label: "Overdue", items: todo.filter((c) => c.due_date && c.due_date < today) },
    { label: "Today", items: todo.filter((c) => c.due_date === today) },
    {
      label: "This week",
      items: todo.filter((c) => c.due_date && c.due_date > today && c.due_date <= weekISO),
    },
    {
      label: "Later",
      items: todo.filter((c) => !c.due_date || c.due_date > weekISO),
    },
  ];
  const completed = chores.filter((c) => c.status === "done").slice(0, 10);

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
        <div className="space-y-5">
          {groups.map(
            (g) =>
              g.items.length > 0 && (
                <section key={g.label} className="space-y-2">
                  <h2 className="px-1 text-sm font-semibold text-slate-900">
                    {g.label}{" "}
                    <span className="font-normal text-slate-400">({g.items.length})</span>
                  </h2>
                  <ul className="card divide-y divide-slate-100">
                    {g.items.map((c) => (
                      <ChoreItem
                        key={c.id}
                        chore={c}
                        members={members}
                        currentUserId={user.id}
                      />
                    ))}
                  </ul>
                </section>
              ),
          )}

          {completed.length > 0 && (
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-semibold text-slate-900">Completed</h2>
              <ul className="card divide-y divide-slate-100">
                {completed.map((c) => (
                  <ChoreItem key={c.id} chore={c} members={members} currentUserId={user.id} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
