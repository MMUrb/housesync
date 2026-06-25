"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { buildReminderMessage } from "@/lib/reminders";
import { Avatar } from "@/components/Avatar";
import { FEATURES } from "@/lib/features";

export interface SettleVM {
  userId: string;
  name: string;
  color: string;
  owe: number;
  owePending: number;
  owed: number;
  owedPending: number;
  markPaidIds: string[];
  confirmIds: string[];
  pay?: { monzo: string | null; paypal: string | null; revolut: string | null; bank: string | null };
}

export function SettleActions({
  items,
  houseId,
  currentUserId,
  currency,
}: {
  items: SettleVM[];
  houseId: string;
  currentUserId: string;
  currency: string;
}) {
  if (items.length === 0) {
    return (
      <div className="card p-5 text-center text-sm text-slate-500">
        You&apos;re all settled up. Nothing to pay or chase 🎉
      </div>
    );
  }

  // FEATURES.smoothSettle picks the redesigned row; flip it off in lib/features.ts
  // to revert to the original compact layout (SettleRowClassic) instantly.
  const Row = FEATURES.smoothSettle ? SettleRow : SettleRowClassic;

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <Row
          key={item.userId}
          item={item}
          houseId={houseId}
          currentUserId={currentUserId}
          currency={currency}
        />
      ))}
    </ul>
  );
}

type RowProps = {
  item: SettleVM;
  houseId: string;
  currentUserId: string;
  currency: string;
};

/** Shared mark-paid / confirm / reminder handlers + state for a settle row. */
function useSettle(item: SettleVM, houseId: string, currentUserId: string, currency: string) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState<"" | "pay" | "confirm">("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setError(null);
    setLoading("pay");
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("expense_splits")
        .update({ status: "paid", paid_at: now })
        .in("id", item.markPaidIds);
      if (error) throw error;
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "marked_paid",
        message: `marked ${formatMoney(item.owe, currency)} as paid to ${item.name}`,
      });
      // Tell the person who's owed (best-effort).
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "paid",
          houseId,
          toUserId: item.userId,
          amount: formatMoney(item.owe, currency),
        }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function confirmReceived() {
    setError(null);
    setLoading("confirm");
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("expense_splits")
        .update({ status: "confirmed", confirmed_at: now })
        .in("id", item.confirmIds);
      if (error) throw error;
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "confirmed_paid",
        message: `confirmed ${item.name} paid ${formatMoney(item.owedPending, currency)}`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function copyReminder() {
    const msg = buildReminderMessage(item.name, item.owed, currency);
    try {
      if (navigator.share) {
        await navigator.share({ text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  return { loading, copied, error, markPaid, confirmReceived, copyReminder };
}

/** Redesigned (default): big colour-coded amount + prominent primary action. */
function SettleRow({ item, houseId, currentUserId, currency }: RowProps) {
  const { loading, copied, error, markPaid, confirmReceived, copyReminder } = useSettle(
    item,
    houseId,
    currentUserId,
    currency,
  );
  const youOwe = item.owe > 0;
  const theyOwe = item.owed > 0;
  const canConfirm = item.owedPending > 0 && item.confirmIds.length > 0;

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={item.name} color={item.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
          <p className="text-xs text-slate-500">
            {youOwe ? "You owe them" : theyOwe ? "They owe you" : "Pending confirmation"}
          </p>
        </div>
        {(youOwe || theyOwe) && (
          <p className={`shrink-0 text-xl font-bold ${youOwe ? "text-red-600" : "text-mint-600"}`}>
            {formatMoney(youOwe ? item.owe : item.owed, currency)}
          </p>
        )}
      </div>

      {item.owePending > 0 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
          {formatMoney(item.owePending, currency)} marked paid, waiting for {item.name} to confirm.
        </p>
      )}

      {/* The confirm action is the one people miss, so make it the headline. */}
      {canConfirm && (
        <button
          onClick={confirmReceived}
          disabled={loading !== ""}
          className="btn-primary btn-block mt-3"
        >
          {loading === "confirm"
            ? "Confirming…"
            : `Confirm ${formatMoney(item.owedPending, currency)} received`}
        </button>
      )}

      {youOwe && (
        <div className="mt-3 space-y-2">
          {item.pay && (
            <div className="flex flex-wrap gap-2">
              <PayLinks pay={item.pay} amount={item.owe} />
            </div>
          )}
          {item.markPaidIds.length > 0 && (
            <button
              onClick={markPaid}
              disabled={loading !== ""}
              className="btn-secondary btn-block"
            >
              {loading === "pay" ? "Saving…" : "I've paid them"}
            </button>
          )}
        </div>
      )}

      {theyOwe && (
        <button onClick={copyReminder} className="btn-ghost btn-block mt-2 text-sm">
          {copied ? "Copied!" : "Send a reminder"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

/** Original compact layout, kept for instant revert via FEATURES.smoothSettle. */
function SettleRowClassic({ item, houseId, currentUserId, currency }: RowProps) {
  const { loading, copied, error, markPaid, confirmReceived, copyReminder } = useSettle(
    item,
    houseId,
    currentUserId,
    currency,
  );

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <Avatar name={item.name} color={item.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-900">{item.name}</p>
          <div className="text-xs">
            {item.owe > 0 && (
              <span className="text-red-600">You owe {formatMoney(item.owe, currency)}</span>
            )}
            {item.owePending > 0 && (
              <span className="text-amber-600">
                {item.owe > 0 ? " · " : ""}
                {formatMoney(item.owePending, currency)} awaiting confirmation
              </span>
            )}
            {item.owed > 0 && (
              <span className="text-mint-600">Owes you {formatMoney(item.owed, currency)}</span>
            )}
            {item.owedPending > 0 && (
              <span className="text-amber-600">
                {item.owed > 0 ? " · " : ""}
                {formatMoney(item.owedPending, currency)} to confirm
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {item.owe > 0 && item.pay && <PayLinks pay={item.pay} amount={item.owe} />}
        {item.owe > 0 && item.markPaidIds.length > 0 && (
          <button onClick={markPaid} disabled={loading !== ""} className="btn-secondary px-3 py-1.5 text-xs">
            {loading === "pay" ? "…" : "Mark as paid"}
          </button>
        )}
        {item.owedPending > 0 && item.confirmIds.length > 0 && (
          <button
            onClick={confirmReceived}
            disabled={loading !== ""}
            className="btn-primary px-3 py-1.5 text-xs"
          >
            {loading === "confirm" ? "…" : "Confirm received"}
          </button>
        )}
        {item.owed > 0 && (
          <button onClick={copyReminder} className="btn-secondary px-3 py-1.5 text-xs">
            {copied ? "Copied!" : "Send a reminder"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </li>
  );
}

function cleanHandle(s: string): string {
  return s
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/\/.*$/, "");
}

function PayLinks({ pay, amount }: { pay: NonNullable<SettleVM["pay"]>; amount: number }) {
  const [copied, setCopied] = useState(false);
  const amt = amount.toFixed(2);
  const links: { label: string; href: string }[] = [];
  if (pay.monzo) links.push({ label: "Monzo", href: `https://monzo.me/${cleanHandle(pay.monzo)}/${amt}` });
  if (pay.paypal) links.push({ label: "PayPal", href: `https://paypal.me/${cleanHandle(pay.paypal)}/${amt}` });
  if (pay.revolut) links.push({ label: "Revolut", href: `https://revolut.me/${cleanHandle(pay.revolut)}` });

  async function copyBank() {
    if (!pay.bank) return;
    try {
      await navigator.clipboard.writeText(pay.bank);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (links.length === 0 && !pay.bank) return null;

  return (
    <>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-3 py-1.5 text-xs"
        >
          Pay · {l.label}
        </a>
      ))}
      {pay.bank && (
        <button type="button" onClick={copyBank} className="btn-secondary px-3 py-1.5 text-xs">
          {copied ? "Copied!" : "Bank details"}
        </button>
      )}
    </>
  );
}
