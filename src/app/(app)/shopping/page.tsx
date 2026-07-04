import { getShoppingItems, requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { ShoppingList } from "@/components/shopping/ShoppingList";

export const metadata = { title: "Shopping" };
export const dynamic = "force-dynamic";

export default async function ShoppingPage() {
  const { user, house, members } = await requireHouse();
  const items = await getShoppingItems(house.id);

  return (
    <div>
      <PageTitle title="Shopping" subtitle="One shared list. Tick things off as you go." />
      <div className="mt-2">
        <ShoppingList
          houseId={house.id}
          currentUserId={user.id}
          initialItems={items}
          members={members}
        />
      </div>
    </div>
  );
}
