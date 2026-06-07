import Link from "next/link";
import { getExpensesAndSplits, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { ExpensesList, type ExpenseVM } from "@/components/expenses/ExpensesList";
import { IconPlus } from "@/components/icons";

export const metadata = { title: "Expenses" };
export const dynamic = "force-dynamic";

export default async function ExpensesPage() {
  const { user, house, members } = await requireHouse();
  const { expenses, splits } = await getExpensesAndSplits(house.id);

  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.profile?.name ?? "Someone";

  const rows: ExpenseVM[] = expenses.map((e) => {
    const mySplit = splits.find((s) => s.expense_id === e.id && s.user_id === user.id);
    const paidByYou = e.paid_by === user.id;

    let impactKind: ExpenseVM["impactKind"] = "none";
    let impactAmount = 0;

    if (paidByYou) {
      const owedToYou = splits
        .filter((s) => s.expense_id === e.id && s.user_id !== user.id && s.status !== "confirmed")
        .reduce((sum, s) => sum + Number(s.amount_owed), 0);
      impactAmount = Math.round(owedToYou * 100) / 100;
      impactKind = impactAmount > 0.004 ? "owed" : "settled";
    } else if (mySplit) {
      impactAmount = Number(mySplit.amount_owed);
      impactKind = mySplit.status === "confirmed" ? "settled" : "owe";
    }

    return {
      id: e.id,
      title: e.title,
      amount: Number(e.amount),
      category: e.category,
      date: e.date,
      paidByName: nameOf(e.paid_by),
      paidByYou,
      impactKind,
      impactAmount,
    };
  });

  return (
    <div>
      <PageTitle
        title="Expenses"
        action={
          <Link href="/expenses/new" className="btn-primary px-3 py-2 text-sm">
            <IconPlus className="h-4 w-4" /> Add
          </Link>
        }
      />
      {rows.length === 0 ? (
        <EmptyExpenses />
      ) : (
        <ExpensesList rows={rows} currency={house.currency} />
      )}
    </div>
  );
}

function EmptyExpenses() {
  return (
    <div className="card mt-2 flex flex-col items-center p-8 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-3xl">🧾</div>
      <h2 className="mt-3 font-semibold text-slate-900">No expenses yet</h2>
      <p className="mt-1 max-w-xs text-sm text-slate-500">
        Add your first shared cost — a bill, the weekly shop, anything — and we&apos;ll split it for
        you.
      </p>
      <Link href="/expenses/new" className="btn-primary mt-5">
        Add your first expense
      </Link>
    </div>
  );
}
