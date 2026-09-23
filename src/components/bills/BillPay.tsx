"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { PayLinks, type PayHandles } from "@/components/payments/PayLinks";

/** The current user's "pay my share of this bill" actions: pay links + mark paid. */
export function BillPay({
  splitIds,
  amount,
  payerName,
  payerId,
  payerPay,
  houseId,
  currentUserId,
  currency,
}: {
  /** My still-unpaid rows for this cycle (several after a part payment). */
  splitIds: string[];
  amount: number;
  payerName: string;
  payerId: string | null;
  payerPay: PayHandles;
  houseId: string;
  currentUserId: string;
  currency: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setLoading(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      // .eq status so a stale screen can only claim rows that are still owed.
      const { error: upErr } = await supabase
        .from("expense_splits")
        .update({ status: "paid", paid_at: now })
        .in("id", splitIds)
        .eq("status", "unpaid");
      if (upErr) throw upErr;
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "marked_paid",
        message: `marked ${formatMoney(amount, currency)} as paid to ${payerName}`,
      });
      // Tell the person who's owed (best-effort).
      if (payerId && payerId !== currentUserId) {
        void fetch("/api/push/notify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          keepalive: true,
          body: JSON.stringify({
            type: "paid",
            houseId,
            toUserId: payerId,
            amount: formatMoney(amount, currency),
          }),
        });
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PayLinks pay={payerPay} amount={amount} />
      <button onClick={markPaid} disabled={loading} className="btn-secondary px-3 py-1.5 text-xs">
        {loading ? "…" : "Mark as paid"}
      </button>
      {error && <p className="w-full text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
