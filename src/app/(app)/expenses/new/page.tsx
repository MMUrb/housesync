import { getHouseCategories, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { AddExpenseForm } from "@/components/expenses/AddExpenseForm";

export const metadata = { title: "Add expense" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ user, house, members }, sp] = await Promise.all([requireHouse(), searchParams]);
  const categories = (await getHouseCategories(house.id)).map((c) => ({
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  // The shopping list can hand over what was bought, so only the amount is
  // left to type. Everything is checked against this house before it is used:
  // a payer must be a member and a category must exist here.
  const paidBy = one(sp.paid_by);
  const category = one(sp.category);
  const prefill = {
    title: one(sp.title).slice(0, 80),
    paidBy: members.some((m) => m.user_id === paidBy) ? paidBy : undefined,
    category: categories.some((c) => c.code === category) ? category : undefined,
    notes: one(sp.notes).slice(0, 500),
  };

  return (
    <div>
      <PageTitle title="Add expense" backHref="/expenses" />
      <AddExpenseForm
        houseId={house.id}
        currentUserId={user.id}
        currency={house.currency}
        members={members}
        categories={categories}
        prefill={prefill.title || prefill.notes ? prefill : undefined}
      />
    </div>
  );
}
