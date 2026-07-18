import { notFound } from "next/navigation";
import { requireHouse } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/app/PageTitle";
import { AddChoreForm, type ChoreEditInit } from "@/components/chores/AddChoreForm";
import type { ChoreRepeat } from "@/lib/types";

export const metadata = { title: "Edit chore" };
export const dynamic = "force-dynamic";

export default async function EditChorePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, house, members } = await requireHouse();
  const supabase = await createClient();

  const { data: chore } = await supabase.from("chores").select("*").eq("id", id).single();
  if (!chore || chore.house_id !== house.id) notFound();

  const edit: ChoreEditInit = {
    choreId: chore.id,
    title: chore.title,
    assignedTo: chore.assigned_to ?? "",
    dueDate: chore.due_date ?? "",
    repeat: chore.repeat as ChoreRepeat,
  };

  return (
    <div>
      <PageTitle title="Edit chore" backHref="/chores" />
      <AddChoreForm houseId={house.id} currentUserId={user.id} members={members} edit={edit} />
    </div>
  );
}
