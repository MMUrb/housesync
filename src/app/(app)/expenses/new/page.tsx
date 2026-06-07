import { requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { AddExpenseForm } from "@/components/expenses/AddExpenseForm";

export const metadata = { title: "Add expense" };
export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  const { user, house, members } = await requireHouse();

  return (
    <div>
      <PageTitle title="Add expense" backHref="/expenses" />
      <AddExpenseForm
        houseId={house.id}
        currentUserId={user.id}
        currency={house.currency}
        members={members}
      />
    </div>
  );
}
