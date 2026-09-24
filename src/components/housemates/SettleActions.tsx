"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { showToast } from "@/components/app/Toast";
import { confirmSheet } from "@/components/app/ConfirmSheet";
import { formatMoney } from "@/lib/format";
import { buildReminderMessage } from "@/lib/reminders";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";
import { Avatar } from "@/components/Avatar";
import { haptic } from "@/lib/haptics";
import { FEATURES } from "@/lib/features";

/** One expense's share of what a person owes (or is owed), for the sheet. */
export interface SettleBreakdownItem {
  title: string;
  emoji: string;
  amount: number;
}

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
  /** Your own "paid" claims awaiting their confirmation — undoable. */
  undoIds: string[];
  pay?: { monzo: string | null; paypal: string | null; revolut: string | null };
  /** What the owe amount is made of, per expense (largest first). */
  oweItems?: SettleBreakdownItem[];
  /** What the owed amount is made of, per expense (largest first). */
  owedItems?: SettleBreakdownItem[];
}

/** A housemate with nothing outstanding whose last confirm landed today. */
export interface SettledTodayVM {
  userId: string;
  name: string;
  color: string;
}

export function SettleActions({
  items,
  houseId,
  currentUserId,
  currency,
  houseName,
  settledToday = [],
}: {
  items: SettleVM[];
  houseId: string;
  currentUserId: string;
  currency: string;
  houseName?: string;
  settledToday?: SettledTodayVM[];
}) {
  const [sheetFor, setSheetFor] = useState<string | null>(null);

  // A refresh can drop the open person from the list (settled from the other
  // side); clear the selection so the sheet can't spontaneously reopen if a
  // later refresh brings them back.
  useEffect(() => {
    if (sheetFor && !items.some((i) => i.userId === sheetFor)) setSheetFor(null);
  }, [sheetFor, items]);

  // FEATURES.smoothSettle picks the redesigned list; flip it off in
  // lib/features.ts to revert to the original compact cards instantly.
  if (!FEATURES.smoothSettle) {
    if (items.length === 0) {
      return (
        <div className="card p-5 text-center text-sm text-slate-500">
          You&apos;re all settled up. Nothing to pay or chase 🎉
        </div>
      );
    }
    return (
      <ul className="space-y-3">
        {items.map((item) => (
          <SettleRowClassic
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

  const sheetItem = items.find((i) => i.userId === sheetFor) ?? null;

  return (
    <div className="space-y-2">
      {(items.length > 0 || settledToday.length > 0) && (
        <ul className="card divide-y divide-slate-100">
          {items.map((item) => (
            <SettleRow
              key={item.userId}
              item={item}
              houseId={houseId}
              currentUserId={currentUserId}
              currency={currency}
              onOpen={() => setSheetFor(item.userId)}
            />
          ))}
          {settledToday.map((p) => (
            <li key={p.userId} className="flex items-center gap-3 p-4">
              <Avatar name={p.name} color={p.color} size="md" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-xs text-slate-400">Settled today ✓</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {items.length > 0 && (
        <p className="px-1 text-center text-xs text-slate-400">
          Tap a person for the full story: what it&apos;s made of, part payments, reminders.
        </p>
      )}

      {items.length === 0 && (
        <div className="card p-6 text-center">
          <p className="text-3xl" aria-hidden="true">
            🎉
          </p>
          <p className="mt-1.5 text-sm font-semibold text-slate-900">All square with everyone</p>
          <p className="mt-1 text-xs text-slate-500">
            Nothing owed{houseName ? ` in ${houseName}` : ""}. Enjoy it while it lasts.
          </p>
        </div>
      )}

      {sheetItem && (
        <PersonSheet
          item={sheetItem}
          houseId={houseId}
          currentUserId={currentUserId}
          currency={currency}
          onClose={() => setSheetFor(null)}
        />
      )}
    </div>
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
  const [loading, setLoading] = useState<"" | "pay" | "confirm" | "undo" | "reject">("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function markPaid() {
    setError(null);
    setLoading("pay");
    void haptic("light");
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
      // Undo exactly the splits just marked: the row's own undo list only
      // catches up once the refresh lands.
      const marked = [...item.markPaidIds];
      const amount = item.owe;
      showToast({
        message: `Marked ${formatMoney(amount, currency)} as paid to ${item.name}`,
        actionLabel: "Undo",
        onAction: () => undoPaid(marked, amount),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  /** True when the confirm actually landed, so the row can play its tick. */
  async function confirmReceived(): Promise<boolean> {
    setError(null);
    setLoading("confirm");
    void haptic("success");
    try {
      const now = new Date().toISOString();
      // .eq("status","paid") so a stale screen can't flip a claim the payer
      // has since taken back (their undo) straight to confirmed.
      const { data: confirmed, error } = await supabase
        .from("expense_splits")
        .update({ status: "confirmed", confirmed_at: now })
        .in("id", item.confirmIds)
        .eq("status", "paid")
        .select("id");
      if (error) throw error;
      if (!confirmed || confirmed.length === 0) {
        setError(`${item.name} took that payment mark back. Refreshing…`);
        router.refresh();
        return false;
      }
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "confirmed_paid",
        message: `confirmed ${item.name} paid ${formatMoney(item.owedPending, currency)}`,
      });
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return false;
    } finally {
      setLoading("");
    }
  }

  // Take back your own mis-tapped "I've paid them".
  async function undoPaid(ids: string[] = item.undoIds, amount: number = item.owePending) {
    setError(null);
    setLoading("undo");
    void haptic("light");
    try {
      // .eq("status","paid") so a stale screen can never revert a payment the
      // other side has already confirmed.
      const { data: reverted, error } = await supabase
        .from("expense_splits")
        .update({ status: "unpaid", paid_at: null })
        .in("id", ids)
        .eq("status", "paid")
        .select("id");
      if (error) throw error;
      if (!reverted || reverted.length === 0) {
        // Also toasted: the undo often runs from a toast after its sheet has
        // closed, where the inline error has nowhere left to render.
        setError(`${item.name} already confirmed this. Refreshing…`);
        showToast({ message: `${item.name} already confirmed this payment.` });
        router.refresh();
        return;
      }
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "unmarked_paid",
        message: `took back a payment mark of ${formatMoney(amount, currency)} to ${item.name}`,
      });
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setError(msg);
      showToast({ message: `Couldn't undo: ${msg}` });
    } finally {
      setLoading("");
    }
  }

  // The money never arrived — put their claim back to unpaid.
  async function rejectClaim() {
    if (
      !(await confirmSheet({
        title: `Mark ${item.name}'s ${formatMoney(item.owedPending, currency)} as not received?`,
        body: "They'll see it as owed again.",
        confirmLabel: "Not received",
        tone: "danger",
      }))
    )
      return;
    setError(null);
    setLoading("reject");
    try {
      // Same guard as undo: only a still-unconfirmed claim can be rejected.
      const { data: reverted, error } = await supabase
        .from("expense_splits")
        .update({ status: "unpaid", paid_at: null })
        .in("id", item.confirmIds)
        .eq("status", "paid")
        .select("id");
      if (error) throw error;
      if (!reverted || reverted.length === 0) {
        setError("That's already been confirmed. Refreshing…");
        router.refresh();
        return;
      }
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "payment_rejected",
        message: `marked ${item.name}'s ${formatMoney(item.owedPending, currency)} as not received`,
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

  return { loading, copied, error, markPaid, confirmReceived, undoPaid, rejectClaim, copyReminder };
}

/**
 * Redesigned list row: one line per person, one button matched to their state.
 * Pay when you owe, Remind when they owe, Confirm when they say they've paid.
 * Everything else lives in the sheet the row opens.
 */
function SettleRow({ item, houseId, currentUserId, currency, onOpen }: RowProps & { onOpen: () => void }) {
  const { loading, copied, error, confirmReceived, undoPaid, copyReminder } = useSettle(
    item,
    houseId,
    currentUserId,
    currency,
  );
  // After a successful confirm the button becomes a drawn tick until the
  // refreshed data replaces the row (usually as a "Settled today" line).
  const [ticked, setTicked] = useState(false);

  const canConfirm = item.owedPending > 0 && item.confirmIds.length > 0;
  const primary: "confirm" | "pay" | "remind" | null = canConfirm
    ? "confirm"
    : item.owe > 0
      ? "pay"
      : item.owed > 0
        ? "remind"
        : null;

  // Ignore opens while an action is in flight (a disabled .btn has
  // pointer-events:none, so its taps would otherwise fall through to the row).
  const open = () => {
    if (loading === "") onOpen();
  };

  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          // Only keys pressed on the row itself: keydowns from the nested
          // buttons bubble here and would open the sheet over their action.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            open();
          }
        }}
        className="flex w-full cursor-pointer items-center gap-3 p-4 text-left transition-colors hover:bg-slate-50 dark:hover:bg-white/[0.03]"
      >
        <Avatar name={item.name} color={item.color} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>

          {canConfirm && (
            <p className="text-xs font-medium text-slate-500">
              Says they paid you {formatMoney(item.owedPending, currency)}
            </p>
          )}
          {item.owe > 0 && (
            <p className="text-xs font-medium text-red-600">
              You owe {formatMoney(item.owe, currency)}
            </p>
          )}
          {!canConfirm && item.owed > 0 && (
            <p className="text-xs font-medium text-mint-600">
              Owes you {formatMoney(item.owed, currency)}
            </p>
          )}
          {canConfirm && item.owed > 0 && (
            <p className="text-xs font-medium text-mint-600">
              Owes you {formatMoney(item.owed, currency)} more
            </p>
          )}

          {item.owePending > 0 && (
            <p className="text-xs text-amber-700">
              ⏳ {formatMoney(item.owePending, currency)} waiting for their confirm ·{" "}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  void undoPaid();
                }}
                disabled={loading !== ""}
                className="font-semibold underline decoration-amber-400 underline-offset-2 disabled:opacity-50"
              >
                {loading === "undo" ? "…" : "Undo"}
              </button>
            </p>
          )}
          {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
        </div>

        {primary === "confirm" && ticked && (
          <span className="hs-tick grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint-50">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-mint-600"
              aria-hidden="true"
            >
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
          </span>
        )}
        {primary === "confirm" && !ticked && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void confirmReceived().then((ok) => {
                if (ok) setTicked(true);
              });
            }}
            disabled={loading !== ""}
            className="btn-primary shrink-0 px-4 py-2"
          >
            {loading === "confirm" ? "…" : "Confirm"}
          </button>
        )}
        {primary === "pay" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              open();
            }}
            className="btn-primary shrink-0 px-4 py-2"
          >
            Pay
          </button>
        )}
        {primary === "remind" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void copyReminder();
            }}
            className="btn-secondary shrink-0 px-4 py-2"
          >
            {copied ? "Copied!" : "Remind"}
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * The whole story for one person: what the amount is made of, how to pay,
 * and the amount box. The amount is editable, full by default, so paying part
 * of it is the same gesture as paying all of it.
 */
function PersonSheet({
  item,
  houseId,
  currentUserId,
  currency,
  onClose,
}: RowProps & { onClose: () => void }) {
  const router = useRouter();
  const supabase = createClient();
  const { loading, copied, error, confirmReceived, undoPaid, rejectClaim, copyReminder } =
    useSettle(item, houseId, currentUserId, currency);
  const [amount, setAmount] = useState(item.owe > 0 ? item.owe.toFixed(2) : "");
  const [payBusy, setPayBusy] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);

  const youOwe = item.owe > 0;
  const canConfirm = item.owedPending > 0 && item.confirmIds.length > 0;
  // Everything claimed, nothing else open: just waiting for them to confirm.
  const waitingOnly = !youOwe && item.owed + item.owedPending <= 0 && item.owePending > 0;

  useEffect(() => {
    const unlock = lockScroll();
    const offBack = onHardwareBack(onClose);
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      unlock();
      offBack();
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function friendlyPayError(err: unknown): string {
    const msg = err instanceof Error ? err.message : String(err ?? "");
    if (msg.includes("pay_more_than_owed")) {
      router.refresh();
      return "That's more than you owe them now. Refreshing…";
    }
    if (msg.includes("pay_itemised") || /schema cache|does not exist/i.test(msg)) {
      return "Paying needs the latest app update. Try again in a minute.";
    }
    return msg || "Something went wrong.";
  }

  async function payAmount() {
    const n = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(n) || n <= 0 || n > item.owe + 0.005) {
      setPayError(`Enter an amount up to ${formatMoney(item.owe, currency)}.`);
      return;
    }
    setPayError(null);
    setPayBusy(true);
    void haptic("light");
    try {
      const { data, error } = await supabase.rpc("pay_itemised", {
        p_house_id: houseId,
        p_to_user: item.userId,
        p_amount: n,
      });
      if (error) throw error;
      const claimed = ((data as { claimed_ids?: string[] } | null)?.claimed_ids ?? []).filter(
        (x): x is string => typeof x === "string",
      );
      await supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "marked_paid",
        message: `marked ${formatMoney(n, currency)} as paid to ${item.name}`,
      });
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "paid",
          houseId,
          toUserId: item.userId,
          amount: formatMoney(n, currency),
        }),
      });
      router.refresh();
      onClose();
      showToast({
        message: `Marked ${formatMoney(n, currency)} as paid to ${item.name}`,
        actionLabel: claimed.length > 0 ? "Undo" : undefined,
        onAction: claimed.length > 0 ? () => undoPaid(claimed, n) : undefined,
      });
    } catch (err) {
      setPayError(friendlyPayError(err));
    } finally {
      setPayBusy(false);
    }
  }

  const items = youOwe ? item.oweItems ?? [] : item.owedItems ?? [];
  const shown = items.slice(0, 6);
  const extra = items.length - shown.length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Settle up with ${item.name}`}
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/45" />
      <div className="card relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-b-none rounded-t-3xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />

        <div className="flex items-center gap-3">
          <Avatar name={item.name} color={item.color} size="md" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-slate-900">
              {youOwe
                ? `You owe ${item.name}`
                : waitingOnly
                  ? `Waiting for ${item.name}`
                  : `${item.name} owes you`}
            </p>
            <p
              className={`text-2xl font-bold ${
                youOwe ? "text-red-600" : waitingOnly ? "text-amber-600" : "text-mint-600"
              }`}
            >
              {formatMoney(
                youOwe ? item.owe : waitingOnly ? item.owePending : item.owed + item.owedPending,
                currency,
              )}
            </p>
          </div>
        </div>

        {item.owePending > 0 && (
          <p className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-700">
            <span>
              {formatMoney(item.owePending, currency)} marked paid, waiting for {item.name} to
              confirm.
            </span>
            {item.undoIds.length > 0 && (
              <button
                type="button"
                onClick={() => void undoPaid()}
                disabled={loading !== ""}
                className="shrink-0 font-semibold underline decoration-amber-400 underline-offset-2 disabled:opacity-50"
              >
                {loading === "undo" ? "…" : "Undo"}
              </button>
            )}
          </p>
        )}

        {shown.length > 0 && (
          <>
            <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              What it&apos;s made of
            </p>
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
              {shown.map((b, i) => (
                <li key={i} className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <span className="min-w-0 truncate text-sm text-slate-700">
                    {b.emoji} {b.title}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-slate-800">
                    {formatMoney(b.amount, currency)}
                  </span>
                </li>
              ))}
              {extra > 0 && (
                <li className="px-3 py-2 text-center text-xs text-slate-400">
                  and {extra} more expense{extra === 1 ? "" : "s"}
                </li>
              )}
            </ul>
          </>
        )}

        {canConfirm && (
          <>
            <button
              type="button"
              onClick={() => void confirmReceived()}
              disabled={loading !== ""}
              className="btn-primary btn-block mt-4"
            >
              {loading === "confirm"
                ? "Confirming…"
                : `Confirm ${formatMoney(item.owedPending, currency)} received`}
            </button>
            {item.owed > 0 && (
              <p className="mt-1.5 text-center text-xs text-slate-400">
                They&apos;ll still owe {formatMoney(item.owed, currency)} after this.
              </p>
            )}
            <button
              type="button"
              onClick={() => void rejectClaim()}
              disabled={loading !== ""}
              className="btn-ghost btn-block mt-1 text-xs text-slate-400"
            >
              {loading === "reject" ? "…" : "Not received?"}
            </button>
          </>
        )}

        {youOwe && (
          <>
            <p className="mb-1.5 mt-4 text-xs font-bold uppercase tracking-wider text-slate-400">
              Pay
            </p>
            {item.pay && (
              <div className="mb-2 flex flex-wrap gap-2">
                <PayLinks pay={item.pay} amount={item.owe} />
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                max={item.owe}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-label={`Amount paid to ${item.name}`}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => void payAmount()}
                disabled={payBusy}
                className="btn-primary shrink-0 px-4 py-2.5"
              >
                {payBusy ? "Saving…" : "I've paid this"}
              </button>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Paid some of it? Change the amount, then tap. {item.name} confirms whatever you send,
              and the rest stays owed.
            </p>
            {payError && <p className="mt-2 text-xs text-red-600">{payError}</p>}
          </>
        )}

        {youOwe && item.owed + item.owedPending > 0 && (
          <p className="mt-4 rounded-lg bg-mint-50 px-3 py-2 text-xs font-medium text-mint-700">
            Separately, {item.name} owes you {formatMoney(item.owed + item.owedPending, currency)}{" "}
            from your expenses{item.owedPending > 0 ? " (some already marked paid)" : ""}.
          </p>
        )}
        {item.owed > 0 && (
          <button type="button" onClick={() => void copyReminder()} className="btn-secondary btn-block mt-4">
            {copied ? "Copied!" : "Copy a polite reminder"}
          </button>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

/** Original compact layout, kept for instant revert via FEATURES.smoothSettle. */
function SettleRowClassic({ item, houseId, currentUserId, currency }: RowProps) {
  const { loading, copied, error, markPaid, confirmReceived, undoPaid, rejectClaim, copyReminder } =
    useSettle(item, houseId, currentUserId, currency);

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
        {item.owePending > 0 && item.undoIds.length > 0 && (
          <button
            onClick={() => undoPaid()}
            disabled={loading !== ""}
            className="btn-secondary px-3 py-1.5 text-xs"
          >
            {loading === "undo" ? "…" : "Undo mark"}
          </button>
        )}
        {item.owedPending > 0 && item.confirmIds.length > 0 && (
          <>
            <button
              onClick={confirmReceived}
              disabled={loading !== ""}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              {loading === "confirm" ? "…" : "Confirm received"}
            </button>
            <button
              onClick={rejectClaim}
              disabled={loading !== ""}
              className="btn-ghost px-3 py-1.5 text-xs text-slate-400"
            >
              {loading === "reject" ? "…" : "Not received?"}
            </button>
          </>
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

export function PayLinks({ pay, amount }: { pay: NonNullable<SettleVM["pay"]>; amount: number }) {
  const amt = amount.toFixed(2);
  const links: { label: string; href: string }[] = [];
  if (pay.monzo) links.push({ label: "Monzo", href: `https://monzo.me/${cleanHandle(pay.monzo)}/${amt}` });
  if (pay.paypal) links.push({ label: "PayPal", href: `https://paypal.me/${cleanHandle(pay.paypal)}/${amt}` });
  if (pay.revolut) links.push({ label: "Revolut", href: `https://revolut.me/${cleanHandle(pay.revolut)}` });

  if (links.length === 0) return null;

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
    </>
  );
}
