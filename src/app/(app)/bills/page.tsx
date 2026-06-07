import Link from "next/link";
import { getBills, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { LogBillButton } from "@/components/bills/LogBillButton";
import { IconPlus } from "@/components/icons";
import { formatMoney, relativeDay } from "@/lib/format";
import { EXPENSE_CATEGORIES } from "@/lib/types";

export const metadata = { title: "Bills" };
export const dynamic = "force-dynamic";

const EMOJI = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.emoji]));

export default async function BillsPage() {
  const { user, house, members } = await requireHouse();
  const bills = await getBills(house.id);
  const memberIds = members.map((m) => m.user_id);
  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.profile?.name ?? "Someone";

  return (
    <div>
      <PageTitle
        title="Recurring bills"
        subtitle="Rent, Wi-Fi, energy and more — set once, never re-type."
        action={
          <Link href="/bills/new" className="btn-primary px-3 py-2 text-sm">
            <IconPlus className="h-4 w-4" /> Add
          </Link>
        }
      />

      {bills.length === 0 ? (
        <div className="card mt-2 flex flex-col items-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-3xl">🔁</div>
          <h2 className="mt-3 font-semibold text-slate-900">No recurring bills yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Add bills like rent or Wi-Fi once. We&apos;ll remind the house and split each payment for
            you.
          </p>
          <Link href="/bills/new" className="btn-primary mt-5">
            Add your first bill
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bills.map((b) => (
            <li key={b.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">
                  {EMOJI[b.category] ?? "💡"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-slate-900">{b.title}</p>
                    <p className="shrink-0 font-semibold text-slate-800">
                      {formatMoney(Number(b.amount), house.currency)}
                    </p>
                  </div>
                  <p className="mt-0.5 text-xs capitalize text-slate-500">
                    {b.frequency}
                    {b.next_due_date ? ` · due ${relativeDay(b.next_due_date)}` : ""} · paid by{" "}
                    {b.paid_by === user.id ? "you" : nameOf(b.paid_by)}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs text-slate-400">
                  Split equally · {memberIds.length}{" "}
                  {memberIds.length === 1 ? "person" : "people"}
                </span>
                <LogBillButton
                  bill={b}
                  memberIds={memberIds}
                  currentUserId={user.id}
                  currency={house.currency}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
