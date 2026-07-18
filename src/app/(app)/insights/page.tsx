import {
  getExpensesAndSplits,
  getHouseCategories,
  requireHouse,
} from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { SpendingPanel } from "@/components/spending/SpendingPanel";
import { SpendByPerson } from "@/components/spending/SpendByPerson";

export const metadata = { title: "Spending insights" };
export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { user, house, members } = await requireHouse();
  const [{ expenses, splits }, categories] = await Promise.all([
    getExpensesAndSplits(house.id),
    getHouseCategories(house.id),
  ]);

  const spendExpenses = expenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    date: e.date,
  }));
  const spendSplits = splits.map((s) => ({
    expense_id: s.expense_id,
    user_id: s.user_id,
    amount_owed: Number(s.amount_owed),
  }));
  const spendMembers = members.map((m) => ({
    id: m.user_id,
    name: m.profile?.name ?? "Housemate",
    color: m.profile?.avatar_color ?? "#6f53f5",
    avatarUrl: m.profile?.avatar_url ?? null,
  }));
  const spendCategories = categories.map((c) => ({
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  return (
    <div className="space-y-5">
      <PageTitle title="Spending insights" />

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Trend &amp; categories</h2>
        <SpendingPanel
          expenses={spendExpenses}
          splits={spendSplits}
          members={spendMembers}
          categories={spendCategories}
          meId={user.id}
          currency={house.currency}
        />
      </section>

      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Who spent what</h2>
        <SpendByPerson
          expenses={spendExpenses}
          splits={spendSplits}
          members={spendMembers}
          meId={user.id}
          currency={house.currency}
        />
      </section>
    </div>
  );
}
