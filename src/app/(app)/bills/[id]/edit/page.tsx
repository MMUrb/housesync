import { notFound } from "next/navigation";
import { getHouseCategories, requireHouse } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/app/PageTitle";
import { AddBillForm, type BillEditInit } from "@/components/bills/AddBillForm";
import { todayISO } from "@/lib/recurrence";
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

  // A cycle the engine already sent that's still ahead: the date field below
  // is the NEXT unsent one, and the form says so.
  const { data: pending } = await supabase
    .from("expenses")
    .select("cycle_due")
    .eq("bill_id", id)
    .eq("auto_cycle", true)
    .gte("cycle_due", todayISO())
    .order("cycle_due", { ascending: true })
    .limit(1);

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
    // The bill's payer, never the viewer: blank when nobody pays it any more
    // (their account was deleted), so picking anyone saves.
    paidBy: bill.paid_by ?? "",
    storedPaidBy: bill.paid_by ?? null,
    dueDay: bill.due_day ?? null,
    reminder: bill.reminder_enabled,
    reminderDays: Array.isArray(bill.reminder_days) ? bill.reminder_days : [3, 0],
    pendingDue: pending?.[0]?.cycle_due ?? null,
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
