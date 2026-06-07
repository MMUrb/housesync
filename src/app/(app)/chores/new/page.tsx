import { requireHouse } from "@/lib/data";
import { PageTitle } from "@/components/app/PageTitle";
import { AddChoreForm } from "@/components/chores/AddChoreForm";

export const metadata = { title: "Add chore" };
export const dynamic = "force-dynamic";

export default async function NewChorePage() {
  const { user, house, members } = await requireHouse();

  return (
    <div>
      <PageTitle title="Add chore" backHref="/chores" />
      <AddChoreForm houseId={house.id} currentUserId={user.id} members={members} />
    </div>
  );
}
