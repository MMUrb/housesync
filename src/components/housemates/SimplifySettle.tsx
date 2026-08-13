"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { buildReminderMessage } from "@/lib/reminders";
import { netCents, houseIsSquare, sweepTargets } from "@/lib/settle";
import { Avatar } from "@/components/Avatar";
import { haptic } from "@/lib/haptics";
import { PayLinks, type SettleVM } from "@/components/housemates/SettleActions";
import { SettleExplainer } from "@/components/housemates/SettleExplainer";
import { reportClientError } from "@/components/ErrorReporter";
import type { Expense, ExpenseSplit, Settlement } from "@/lib/types";

// Simplified settle up (house.settle_mode === "simplified"). Payments are
// settlement rows, not split-status flips, so one transfer can clear debts to
// several people. Split statuses reconcile in one sweep when the whole house
// reaches zero, see maybeSweep below.

type PayInfo = NonNullable<SettleVM["pay"]>;

export interface SimplifyVM {
  houseId: string;
  currentUserId: string;
  currency: string;
  /** My outgoing transfers from the plan (what I still need to pay). */
  myOut: { toId: string; name: string; color: string; amount: number; pay: PayInfo }[];
  /** Plan transfers coming my way (what others still owe me). */
  myIn: { fromId: string; name: string; color: string; amount: number }[];
  /** My pending settlements awaiting the recipient's confirm (undoable). */
  pendingOut: { id: string; name: string; amount: number }[];
  /** Pending settlements to me awaiting MY confirm. */
  pendingIn: { id: string; name: string; amount: number }[];
  /** Raw per-person debts (the itemised view), for the disclosure. */
  rawPairs: {
    userId: string;
    name: string;
    color: string;
    amount: number;
    direction: "you_owe" | "owes_you";
  }[];
  /** House-wide counts for the "5 payments into 3" footnote. */
  planCount: number;
  pairCount: number;
  /** Self-heal: the server saw a square house with an unfinished sweep. */
  sweepDue: { splitIds: string[]; settlementIds: string[] };
  square: boolean;
}

/** PostgREST puts .in() lists in the URL, so keep each request comfortably small. */
function chunk<T>(arr: T[], size = 80): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Confirm all open splits + absorb all settlements once the house is square. */
async function runSweep(
  supabase: ReturnType<typeof createClient>,
  splitIds: string[],
  settlementIds: string[],
): Promise<void> {
  const now = new Date().toISOString();
  for (const ids of chunk(splitIds)) {
    const { error } = await supabase
      .from("expense_splits")
      .update({ status: "confirmed", confirmed_at: now })
      .in("id", ids);
    if (error) throw error;
  }
  for (const ids of chunk(settlementIds)) {
    const { error } = await supabase
      .from("settlements")
      .update({ absorbed: true })
      .in("id", ids);
    if (error) throw error;
  }
}

export function SimplifySettle(vm: SimplifyVM) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [partFor, setPartFor] = useState<string | null>(null);
  const [partAmount, setPartAmount] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const healed = useRef(false);

  const { currency } = vm;

  // Self-heal: a previous confirm crashed between "confirmed" and the sweep.
  // Any member's device can finish it, both updates are idempotent.
  useEffect(() => {
    if (healed.current) return;
    if (vm.sweepDue.splitIds.length === 0 && vm.sweepDue.settlementIds.length === 0) return;
    healed.current = true;
    runSweep(supabase, vm.sweepDue.splitIds, vm.sweepDue.settlementIds)
      .then(() => router.refresh())
      .catch((e) => reportClientError(`settle sweep self-heal: ${e instanceof Error ? e.message : e}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * After MY confirm, check whether the house just hit zero, and if so run
   * the reconciling sweep (fresh data, not the page's stale props).
   */
  async function maybeSweep(): Promise<void> {
    const { data: expData, error: expErr } = await supabase
      .from("expenses")
      .select("id, paid_by")
      .eq("house_id", vm.houseId);
    if (expErr) throw expErr;
    const expenses = (expData ?? []) as Expense[];
    let splits: ExpenseSplit[] = [];
    if (expenses.length > 0) {
      const { data, error } = await supabase
        .from("expense_splits")
        .select("id, expense_id, user_id, amount_owed, status")
        .in("expense_id", expenses.map((e) => e.id));
      if (error) throw error;
      splits = (data ?? []) as ExpenseSplit[];
    }
    const { data: setts, error: settErr } = await supabase
      .from("settlements")
      .select("*")
      .eq("house_id", vm.houseId);
    if (settErr) throw settErr;
    const settlements = (setts ?? []) as Settlement[];

    const nets = netCents(expenses, splits, settlements);
    if (!houseIsSquare(nets, settlements)) return;

    const targets = sweepTargets(splits, settlements);
    await runSweep(supabase, targets.splitIds, targets.settlementIds);
    // Tell the house in chat, the same way settings changes do.
    void supabase
      .from("messages")
      .insert({
        house_id: vm.houseId,
        user_id: vm.currentUserId,
        kind: "system",
        body: "confirmed the last payment, the whole house is settled up 🎉",
      })
      .then(() => {});
  }

  async function pay(toId: string, name: string, amount: number): Promise<void> {
    setError(null);
    setLoading(`pay:${toId}`);
    void haptic("light");
    try {
      const { error } = await supabase.from("settlements").insert({
        house_id: vm.houseId,
        from_user: vm.currentUserId,
        to_user: toId,
        amount,
        status: "pending",
      });
      if (error) throw error;
      await supabase.from("activity").insert({
        house_id: vm.houseId,
        user_id: vm.currentUserId,
        type: "marked_paid",
        message: `paid ${formatMoney(amount, currency)} to ${name} (settle up)`,
      });
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          type: "paid",
          houseId: vm.houseId,
          toUserId: toId,
          amount: formatMoney(amount, currency),
        }),
      });
      setPartFor(null);
      setPartAmount("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  // Take back a mis-tapped payment mark. The status guard means a stale
  // screen can never delete a payment the other side already confirmed.
  async function undo(id: string, name: string, amount: number): Promise<void> {
    setError(null);
    setLoading(`undo:${id}`);
    void haptic("light");
    try {
      const { data: removed, error } = await supabase
        .from("settlements")
        .delete()
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!removed || removed.length === 0) {
        setError(`${name} already confirmed this. Refreshing…`);
        router.refresh();
        return;
      }
      await supabase.from("activity").insert({
        house_id: vm.houseId,
        user_id: vm.currentUserId,
        type: "unmarked_paid",
        message: `took back a payment mark of ${formatMoney(amount, currency)} to ${name}`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function confirmReceived(id: string, name: string, amount: number): Promise<void> {
    setError(null);
    setLoading(`confirm:${id}`);
    void haptic("success");
    try {
      const { data: updated, error } = await supabase
        .from("settlements")
        .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!updated || updated.length === 0) {
        setError("That one's already been handled. Refreshing…");
        router.refresh();
        return;
      }
      await supabase.from("activity").insert({
        house_id: vm.houseId,
        user_id: vm.currentUserId,
        type: "confirmed_paid",
        message: `confirmed ${name} paid ${formatMoney(amount, currency)}`,
      });
      try {
        await maybeSweep();
      } catch (e) {
        // The confirm itself succeeded; the sweep self-heals on next load.
        reportClientError(`settle sweep: ${e instanceof Error ? e.message : e}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function notReceived(id: string, name: string, amount: number): Promise<void> {
    if (
      !confirm(
        `Mark ${name}'s ${formatMoney(amount, currency)} as not received? They'll see it as owed again.`,
      )
    )
      return;
    setError(null);
    setLoading(`reject:${id}`);
    try {
      const { data: removed, error } = await supabase
        .from("settlements")
        .delete()
        .eq("id", id)
        .eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!removed || removed.length === 0) {
        setError("That one's already been handled. Refreshing…");
        router.refresh();
        return;
      }
      await supabase.from("activity").insert({
        house_id: vm.houseId,
        user_id: vm.currentUserId,
        type: "payment_rejected",
        message: `marked ${name}'s ${formatMoney(amount, currency)} as not received`,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading("");
    }
  }

  async function copyReminder(fromId: string, name: string, amount: number): Promise<void> {
    const msg = buildReminderMessage(name, amount, currency);
    try {
      if (navigator.share) {
        await navigator.share({ text: msg });
      } else {
        await navigator.clipboard.writeText(msg);
        setCopied(fromId);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      /* cancelled */
    }
  }

  const busy = loading !== "";
  const totalOut = vm.myOut.reduce((s, t) => s + t.amount, 0);
  const nothingForMe =
    vm.myOut.length === 0 && vm.myIn.length === 0 && vm.pendingOut.length === 0 && vm.pendingIn.length === 0;

  // "Settles Alex and Priya too": only when one payment covers several people.
  const alsoCovers =
    vm.myOut.length === 1
      ? vm.rawPairs
          .filter((p) => p.userId !== vm.myOut[0].toId)
          .map((p) => p.name)
      : [];

  return (
    <div className="space-y-3">
      {vm.square ? (
        <div className="card p-5 text-center text-sm text-slate-500">
          You&apos;re all settled up. Nothing to pay or chase 🎉
        </div>
      ) : (
        <>
          {/* The simplified plan card */}
          {(vm.myOut.length > 0 || vm.pendingOut.length > 0) && (
            <div className="rounded-2xl bg-gradient-to-br from-brand-600 to-brand-500 p-4 shadow-soft">
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                ✦ Simplified
              </span>
              {vm.myOut.length > 0 && (
                <h3 className="mt-2.5 text-lg font-bold leading-snug text-white">
                  {vm.myOut.length === 1 && vm.rawPairs.length > 1
                    ? "Clear everything with one payment"
                    : vm.myOut.length === 1
                      ? "One payment and you're square"
                      : `${vm.myOut.length} payments and you're square`}
                </h3>
              )}

              {vm.myOut.map((t) => (
                <div key={t.toId} className="mt-3">
                  <div className="flex items-center gap-2.5 rounded-xl bg-white/15 p-2.5">
                    <Avatar name={t.name} color={t.color} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">Pay {t.name}</p>
                      {t.toId === vm.myOut[0].toId && alsoCovers.length > 0 && (
                        <p className="truncate text-xs text-brand-100">
                          Settles things with {alsoCovers.join(" and ")} too
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-base font-bold text-white">
                      {formatMoney(t.amount, currency)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <PayLinks pay={t.pay} amount={t.amount} />
                  </div>

                  {/* Arbitrary-value white: the dark remap rewrites the
                      bg-white utility, but this button must stay white on the
                      purple card in both themes. */}
                  <button
                    onClick={() => pay(t.toId, t.name, t.amount)}
                    disabled={busy}
                    className="btn btn-block mt-2 bg-[#ffffff] text-brand-700 hover:bg-[#f2f1ff]"
                  >
                    {loading === `pay:${t.toId}`
                      ? "Saving…"
                      : `I've paid ${t.name} ${formatMoney(t.amount, currency)}`}
                  </button>

                  {partFor === t.toId ? (
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0.01"
                        max={t.amount}
                        step="0.01"
                        placeholder={`Up to ${t.amount.toFixed(2)}`}
                        value={partAmount}
                        onChange={(e) => setPartAmount(e.target.value)}
                        className="input flex-1 bg-white/95"
                      />
                      <button
                        onClick={() => {
                          const n = Math.round(Number(partAmount) * 100) / 100;
                          if (!Number.isFinite(n) || n <= 0 || n > t.amount + 0.005) {
                            setError(`Enter an amount up to ${formatMoney(t.amount, currency)}.`);
                            return;
                          }
                          void pay(t.toId, t.name, n);
                        }}
                        disabled={busy}
                        className="btn shrink-0 bg-white/20 text-white hover:bg-white/30"
                      >
                        Save
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPartFor(t.toId);
                        setPartAmount("");
                        setError(null);
                      }}
                      className="mt-1 w-full py-1.5 text-center text-xs font-semibold text-brand-100 underline decoration-brand-300 underline-offset-2"
                    >
                      Pay part of it
                    </button>
                  )}
                </div>
              ))}

              {vm.pendingOut.map((p) => (
                <div
                  key={p.id}
                  className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-white/15 px-3 py-2.5 text-xs font-medium text-white"
                >
                  <span>
                    {formatMoney(p.amount, currency)} on its way to {p.name}, waiting for them to
                    confirm.
                  </span>
                  <button
                    onClick={() => undo(p.id, p.name, p.amount)}
                    disabled={busy}
                    className="shrink-0 font-bold underline underline-offset-2 disabled:opacity-50"
                  >
                    {loading === `undo:${p.id}` ? "…" : "Undo"}
                  </button>
                </div>
              ))}

              {vm.pairCount > vm.planCount && (
                <p className="mt-3 text-center text-[11px] font-medium text-brand-100">
                  Across the house this turns {vm.pairCount} payments into {vm.planCount}
                </p>
              )}
              <button
                onClick={() => setShowHow(true)}
                className="mt-1 w-full pb-0.5 text-center text-xs font-semibold text-brand-100 underline underline-offset-2"
              >
                How does this work?
              </button>
            </div>
          )}

          {/* Payments coming to me */}
          {(vm.pendingIn.length > 0 || vm.myIn.length > 0) && (
            <ul className="space-y-3">
              {vm.pendingIn.map((p) => (
                <li key={p.id} className="card p-4">
                  <p className="text-sm font-semibold text-slate-900">
                    {p.name} says they&apos;ve paid you {formatMoney(p.amount, currency)}
                  </p>
                  <button
                    onClick={() => confirmReceived(p.id, p.name, p.amount)}
                    disabled={busy}
                    className="btn-primary btn-block mt-3"
                  >
                    {loading === `confirm:${p.id}`
                      ? "Confirming…"
                      : `Confirm ${formatMoney(p.amount, currency)} received`}
                  </button>
                  <button
                    onClick={() => notReceived(p.id, p.name, p.amount)}
                    disabled={busy}
                    className="btn-ghost btn-block mt-1 text-xs text-slate-400"
                  >
                    {loading === `reject:${p.id}` ? "…" : "Not received?"}
                  </button>
                </li>
              ))}
              {vm.myIn.map((t) => (
                <li key={t.fromId} className="card flex items-center gap-3 p-4">
                  <Avatar name={t.name} color={t.color} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">Will pay you</p>
                  </div>
                  <p className="shrink-0 text-xl font-bold text-mint-600">
                    {formatMoney(t.amount, currency)}
                  </p>
                  <button
                    onClick={() => copyReminder(t.fromId, t.name, t.amount)}
                    className="btn-ghost shrink-0 px-3 py-1.5 text-xs"
                  >
                    {copied === t.fromId ? "Copied!" : "Remind"}
                  </button>
                </li>
              ))}
            </ul>
          )}

          {nothingForMe && (
            <div className="card p-5 text-center text-sm text-slate-500">
              You&apos;re square. The rest of the house is still settling up between themselves.
            </div>
          )}

          {/* Original debts, always one tap away */}
          {vm.rawPairs.length > 0 && (
            <div className="card overflow-hidden">
              <button
                onClick={() => setShowRaw((v) => !v)}
                className="flex w-full items-center gap-2 p-4 text-left text-sm font-semibold text-slate-700"
              >
                Original debts
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  className={`ml-auto h-4 w-4 shrink-0 text-slate-400 transition-transform ${showRaw ? "rotate-90" : ""}`}
                  aria-hidden="true"
                >
                  <path
                    d="M8 5l5 5-5 5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              {showRaw && (
                <>
                  <ul className="divide-y divide-slate-100 border-t border-slate-100">
                    {vm.rawPairs.map((p) => (
                      <li key={p.userId} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={p.name} color={p.color} size="sm" />
                        <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">
                          {p.name}
                        </p>
                        <p
                          className={`shrink-0 text-sm font-bold ${p.direction === "you_owe" ? "text-red-600" : "text-mint-600"}`}
                        >
                          {formatMoney(p.amount, currency)}
                        </p>
                      </li>
                    ))}
                  </ul>
                  <p className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-500">
                    These are the raw debts behind the plan above. Expense ticks clear when the
                    whole house is square.
                  </p>
                </>
              )}
            </div>
          )}
        </>
      )}

      {error && <p className="px-1 text-xs text-red-600">{error}</p>}

      <SettleExplainer open={showHow} onClose={() => setShowHow(false)} />
    </div>
  );
}
