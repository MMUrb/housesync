"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { splitEqually } from "@/lib/balances";
import { advancePastToday, todayISO } from "@/lib/recurrence";
import { formatMoney } from "@/lib/format";
import type { BillSplit, RecurringBill } from "@/lib/types";

/** The create_bill_cycle guard codes, said in plain words. */
export function cycleErrorMessage(message: string): string {
  if (message.includes("cycle_payer_not_member")) {
    return "Whoever pays this bill has left the house. Edit the bill to pick a new payer first.";
  }
  if (message.includes("cycle_share_not_member")) {
    return "Someone in this split has left the house. Refresh and try again.";
  }
  if (message.includes("cycle_shares_dont_add_up") || message.includes("cycle_negative_share")) {
    return "The shares don't add up to the bill any more. Refresh and try again.";
  }
  if (message.includes("cycle_bill_has_portions")) {
    return "This bill is split by portions, so it can't be split equally. Whoever pays it needs to update them.";
  }
  if (message.includes("cycle_period_already_billed")) {
    return "That period has already been billed. Check the bill's next due date, then try again.";
  }
  if (/schema cache|does not exist|could not find the function/i.test(message)) {
    return "Requesting needs the app's latest update, which is still rolling out. Try again in a minute.";
  }
  return message;
}

/**
 * Records that this period's bill has been paid: creates a real expense and
 * rolls the bill's next due date forward, all in one database transaction
 * (create_bill_cycle). The function compare-and-swaps the due date, the payer
 * and the portions this page rendered, so a page left open (or two
 * housemates tapping at once) can never request a cycle twice or with old
 * numbers. Shares are the bill's portions when it has a valid set, otherwise
 * an equal split across the house.
 */
export function LogBillButton({
  bill,
  memberIds,
  currentUserId,
  currency,
  expectedPayer,
  portionsSeen,
  portionShares,
}: {
  bill: RecurringBill;
  memberIds: string[];
  currentUserId: string;
  currency: string;
  /** The payer this page rendered (the bill's paid_by). */
  expectedPayer: string;
  /** The bill's portion rows exactly as this page rendered them ([] for none). */
  portionsSeen: Pick<BillSplit, "user_id" | "share_type" | "value">[];
  /** Per-person amounts from the bill's portions (already pence-exact). */
  portionShares?: { user_id: string; amount: number }[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A "changed, refreshing" note is about the old page: once the refreshed
  // bill arrives (date, payer or portions differ), it no longer applies.
  const billKey = `${bill.next_due_date}|${expectedPayer}|${JSON.stringify(portionsSeen)}`;
  useEffect(() => {
    setError(null);
  }, [billKey]);

  async function log() {
    setError(null);
    setLoading(true);
    try {
      const payer = expectedPayer;
      const byPortions = Boolean(portionShares && portionShares.length > 0);
      let rows: { user_id: string; amount_owed: number }[];
      if (byPortions) {
        rows = (portionShares ?? [])
          .filter((s) => s.user_id === payer || s.amount > 0)
          .map((s) => ({ user_id: s.user_id, amount_owed: s.amount }));
      } else {
        const ids = memberIds.length > 0 ? memberIds : [payer];
        const shares = splitEqually(Number(bill.amount), ids.length);
        rows = ids.map((id, i) => ({ user_id: id, amount_owed: shares[i] }));
      }

      // Roll past today, not just one period, so logging a long-overdue bill
      // doesn't leave it flagged overdue. due_day anchors month-based rolls,
      // so "the 31st" survives short months.
      const base = bill.next_due_date ?? todayISO();
      const { data: res, error: rpcErr } = await supabase.rpc("create_bill_cycle", {
        p_bill_id: bill.id,
        p_expected_due: bill.next_due_date,
        p_expected_payer: payer,
        p_expected_portions: portionsSeen.map((p) => ({
          user_id: p.user_id,
          share_type: p.share_type,
          value: Number(p.value),
        })),
        p_expense_date: todayISO(),
        p_next_due: advancePastToday(base, bill.frequency, bill.due_day ?? undefined),
        p_rows: rows,
        p_auto: false,
        p_split_type: byPortions ? "custom" : "equal",
        p_nudge_after_days: 7,
        p_notes: "Requested from recurring bill",
        p_actor: currentUserId,
      });
      if (rpcErr) throw new Error(cycleErrorMessage(rpcErr.message ?? ""));
      const status = (res as { status?: string } | null)?.status;
      if (status !== "created") {
        // stale (the date, payer or portions changed since this page loaded)
        // or missing: nothing was written.
        setError("This bill changed a moment ago, so nothing was requested. Refreshing…");
        router.refresh();
        return;
      }

      await supabase.from("activity").insert({
        house_id: bill.house_id,
        user_id: currentUserId,
        type: "bill_logged",
        message: `requested everyone's share of ${bill.title} (${formatMoney(Number(bill.amount), currency)})`,
      });

      // Notify everyone who owes a share (best-effort). With portions the
      // amounts differ per person, so the push names the bill, not a share.
      const npRow = rows.find((r) => r.user_id !== payer);
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "bill_request",
          houseId: bill.house_id,
          title: bill.title,
          share: byPortions ? undefined : formatMoney(npRow?.amount_owed ?? 0, currency),
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
