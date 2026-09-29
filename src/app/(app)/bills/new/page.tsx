import { getHouseCategories, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { AddBillForm, type BillPreset } from "@/components/bills/AddBillForm";
import { nextDueForDay } from "@/lib/recurrence";

export const metadata = { title: "Add recurring bill" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function NewBillPage({
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

  // The dashboard's rent-day card: monthly rent on the house's own rent day,
  // so only the amount is left to type.
  const preset: BillPreset | undefined =
    one(sp.preset) === "rent" && house.rent_due_day
      ? {
          title: "Rent",
          category: "rent",
          nextDue: nextDueForDay(house.rent_due_day),
          dueDay: house.rent_due_day,
        }
      : undefined;

  return (
    <div>
      <PageTitle title="Add recurring bill" backHref="/bills" />
      <AddBillForm
        houseId={house.id}
        currentUserId={user.id}
        currency={house.currency}
        members={members}
        categories={categories}
        preset={preset}
      />
    </div>
  );
}
