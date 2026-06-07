import { requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { AddBillForm } from "@/components/bills/AddBillForm";

export const metadata = { title: "Add recurring bill" };
export const dynamic = "force-dynamic";

export default async function NewBillPage() {
  const { user, house, members } = await requireHouse();

  return (
    <div>
      <PageTitle title="Add recurring bill" backHref="/bills" />
      <AddBillForm
        houseId={house.id}
        currentUserId={user.id}
        currency={house.currency}
        members={members}
      />
    </div>
  );
}
