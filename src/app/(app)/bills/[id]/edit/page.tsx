import { notFound } from "next/navigation";
import { getHouseCategories, requireHouse } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/app/PageTitle";
import { AddBillForm, type BillEditInit } from "@/components/bills/AddBillForm";
import type { BillFrequency } from "@/lib/types";

export const metadata = { title: "Edit bill" };
export const dynamic = "force-dynamic";

export default async function EditBillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, house, members } = await requireHouse();
  const supabase = await createClient();

  const { data: bill } = await supabase.from("recurring_bills").select("*").eq("id", id).single();
  if (!bill || bill.house_id !== house.id) notFound();

  const categories = (await getHouseCategories(house.id)).map((c) => ({
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  const edit: BillEditInit = {
    billId: bill.id,
    title: bill.title,
    amount: Number(bill.amount),
    category: bill.category,
    frequency: bill.frequency as BillFrequency,
    nextDue: bill.next_due_date ?? "",
    paidBy: bill.paid_by ?? user.id,
    reminder: bill.reminder_enabled,
  };

  return (
    <div>
      <PageTitle title="Edit bill" backHref="/bills" />
      <AddBillForm
        houseId={house.id}
        currentUserId={user.id}
        currency={house.currency}
        members={members}
        categories={categories}
        edit={edit}
      />
    </div>
  );
}
