"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { splitEqually } from "@/lib/balances";
import { advanceDate, todayISO } from "@/lib/recurrence";
import { formatMoney } from "@/lib/format";
import type { RecurringBill } from "@/lib/types";

/**
 * Records that this period's bill has been paid: creates a real expense (split
 * equally across the house) and rolls the bill's next due date forward.
 */
export function LogBillButton({
  bill,
  memberIds,
  currentUserId,
  currency,
}: {
  bill: RecurringBill;
  memberIds: string[];
  currentUserId: string;
  currency: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function log() {
    setError(null);
    setLoading(true);
    try {
      const payer = bill.paid_by ?? currentUserId;
      const ids = memberIds.length > 0 ? memberIds : [payer];
      const shares = splitEqually(Number(bill.amount), ids.length);

      const { data: expense, error: expErr } = await supabase
        .from("expenses")
        .insert({
          house_id: bill.house_id,
          title: bill.title,
          amount: Number(bill.amount),
          category: bill.category,
          paid_by: payer,
          split_type: "equal",
          date: todayISO(),
          notes: "Requested from recurring bill",
          created_by: currentUserId,
          bill_id: bill.id,
        })
        .select()
        .single();
      if (expErr) throw expErr;

      const now = new Date().toISOString();
      const rows = ids.map((id, i) => ({
        expense_id: expense.id,
        user_id: id,
        amount_owed: shares[i],
        status: id === payer ? "confirmed" : "unpaid",
        paid_at: id === payer ? now : null,
        confirmed_at: id === payer ? now : null,
      }));
      const { error: splitErr } = await supabase.from("expense_splits").insert(rows);
      if (splitErr) throw splitErr;

      // Roll the due date forward.
      const base = bill.next_due_date ?? todayISO();
      await supabase
        .from("recurring_bills")
        .update({ next_due_date: advanceDate(base, bill.frequency) })
        .eq("id", bill.id);

      await supabase.from("activity").insert({
        house_id: bill.house_id,
        user_id: currentUserId,
        type: "bill_logged",
        message: `requested everyone's share of ${bill.title} (${formatMoney(Number(bill.amount), currency)})`,
      });

      // Notify everyone who owes a share (best-effort).
      const npIdx = ids.findIndex((id) => id !== payer);
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "bill_request",
          houseId: bill.house_id,
          title: bill.title,
          share: formatMoney(shares[npIdx >= 0 ? npIdx : 0] ?? 0, currency),
        }),
      });

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not log the payment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="text-right">
      <button onClick={log} disabled={loading} className="btn-primary px-3 py-1.5 text-xs">
        {loading ? "…" : "Request from house"}
      </button>
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
