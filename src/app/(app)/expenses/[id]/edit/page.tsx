import { notFound } from "next/navigation";
import { getHouseCategories, requireHouse } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/app/PageTitle";
import { AddExpenseForm, type ExpenseEditInit } from "@/components/expenses/AddExpenseForm";
import type { SplitType } from "@/lib/types";

export const metadata = { title: "Edit expense" };
export const dynamic = "force-dynamic";

export default async function EditExpensePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, house, members } = await requireHouse();
  const supabase = await createClient();

  const { data: expense } = await supabase.from("expenses").select("*").eq("id", id).single();
  // RLS already limits reads to the user's houses; guard the mismatch anyway.
  if (!expense || expense.house_id !== house.id) notFound();

  const { data: splitRows } = await supabase
    .from("expense_splits")
    .select("user_id, amount_owed")
    .eq("expense_id", id);
  const splits = splitRows ?? [];

  const total = Number(expense.amount) || 0;
  const splitType = expense.split_type as SplitType;

  // Rebuild the form's per-member inputs from the stored splits. Custom keeps the
  // pound amounts; percentage back-computes each share's % of the total.
  const custom: Record<string, string> = {};
  if (splitType === "custom") {
    splits.forEach((s) => (custom[s.user_id] = String(Number(s.amount_owed))));
  } else if (splitType === "percentage") {
    splits.forEach(
      (s) =>
        (custom[s.user_id] = String(
          total > 0 ? Math.round((Number(s.amount_owed) / total) * 100) : 0,
        )),
    );
  }

  const edit: ExpenseEditInit = {
    expenseId: expense.id,
    title: expense.title,
    amount: Number(expense.amount),
    paidBy: expense.paid_by ?? user.id,
    category: expense.category,
    date: expense.date,
    splitType,
    selectedIds: splits.map((s) => s.user_id),
    custom,
    notes: expense.notes ?? "",
    receiptPath: expense.receipt_url ?? null,
    originalShares: Object.fromEntries(splits.map((s) => [s.user_id, Number(s.amount_owed)])),
  };

  const categories = (await getHouseCategories(house.id)).map((c) => ({
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  return (
    <div>
      <PageTitle title="Edit expense" backHref="/expenses" />
      <AddExpenseForm
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
