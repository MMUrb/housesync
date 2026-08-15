"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/format";
import { buildReminderMessage } from "@/lib/reminders";
import { Avatar } from "@/components/Avatar";
import { haptic } from "@/lib/haptics";
import { PayLinks, type SettleVM } from "@/components/housemates/SettleActions";
import { SettleExplainer } from "@/components/housemates/SettleExplainer";
import { reportClientError } from "@/components/ErrorReporter";

// Simplified settle up (house.settle_mode === "simplified"). Payments are
// settlement rows, not split-status flips, so one transfer can clear debts to
// several people. Split statuses reconcile when the whole house reaches zero,
// via the settle_sweep() Postgres function (migration 0039): it recomputes the
// nets and does both updates in ONE transaction, so an interrupted sweep can
// never leave half the ledger reconciled.

type PayInfo = NonNullable<SettleVM["pay"]>;

/** Friendly copy for the DB guard errors raised by migration 0039. */
function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  if (msg.includes("settlement_requires_simplified"))
    return "This house isn't using simplified settle up any more. Refreshing…";
  if (msg.includes("settle_mode_")) return "The house settings changed underneath you. Refreshing…";
  return msg || "Something went wrong.";
}

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
  /**
   * Self-heal: the server saw a square house that still has open splits or
   * unabsorbed settlements (a confirm landed but the sweep call never ran).
   */
  sweepDue: boolean;
  square: boolean;
}

export function SimplifySettle(vm: SimplifyVM) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [partError, setPartError] = useState<string | null>(null);
  const [showHow, setShowHow] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [partFor, setPartFor] = useState<string | null>(null);
  const [partAmount, setPartAmount] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const healed = useRef(false);
  // Idempotency key for the in-flight payment: a retry after a timed-out
  // request reuses the same id, so a payment that actually landed can never
  // be recorded twice. Cleared once the server confirms it.
  const payKey = useRef<{ key: string; id: string } | null>(null);

  const { currency } = vm;

  /**
   * Ask the database to reconcile if the house is square. Atomic and
   * idempotent (settle_sweep in migration 0039); returns true only for the
   * caller whose call actually swept, which is who posts the chat note.
   */
  async function sweep(): Promise<boolean> {
    const { data, error } = await supabase.rpc("settle_sweep", { p_house_id: vm.houseId });
    if (error) throw error;
    return data === true;
  }

  async function announceSettled(): Promise<void> {
    await supabase.from("messages").insert({
      house_id: vm.houseId,
      user_id: vm.currentUserId,
      kind: "system",
      body: "confirmed the last payment, the whole house is settled up 🎉",
    });
  }

  // Self-heal on mount: any member's device can finish an unswept square house.
  useEffect(() => {
    if (healed.current || !vm.sweepDue) return;
    healed.current = true;
    sweep()
      .then(async (swept) => {
        if (swept) await announceSettled();
        router.refresh();
      })
      .catch((e) => reportClientError(`settle sweep self-heal: ${e instanceof Error ? e.message : e}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vm.sweepDue]);

  async function pay(toId: string, name: string, amount: number): Promise<void> {
    setError(null);
    setPartError(null);
    setLoading(`pay:${toId}`);
    void haptic("light");
    try {
      const key = `${toId}:${amount}`;
      if (!payKey.current || payKey.current.key !== key) {
        payKey.current = { key, id: crypto.randomUUID() };
      }
      const { error } = await supabase.from("settlements").insert({
        id: payKey.current.id,
        house_id: vm.houseId,
        from_user: vm.currentUserId,
        to_user: toId,
        amount,
        status: "pending",
      });
      // 23505 = unique_violation on the id: the earlier attempt landed after
      // all, so this retry is a success, not a second payment.
      if (error && error.code !== "23505") throw error;
      payKey.current = null;
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
      const msg = friendlyError(err);
      setError(msg);
      if (msg.endsWith("Refreshing…")) router.refresh();
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
        if (await sweep()) await announceSettled();
      } catch (e) {
        // The confirm itself succeeded; the mount-time self-heal retries the
        // sweep on the next load of this page, by any housemate.
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
                        <p className="truncate text-xs text-[#e7e5ff]">
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

                  {/* Everything on this purple card uses arbitrary-value colours:
                      the dark remap layer rewrites bg-white, text-brand-*, the
                      .input class etc., and this card must read the same in
                      both themes. */}
                  <button
                    onClick={() => pay(t.toId, t.name, t.amount)}
                    disabled={busy}
                    className="btn btn-block mt-2 bg-[#ffffff] text-[#4f31bd] hover:bg-[#f2f1ff]"
                  >
                    {loading === `pay:${t.toId}`
                      ? "Saving…"
                      : `I've paid ${t.name} ${formatMoney(t.amount, currency)}`}
                  </button>

                  {partFor === t.toId ? (
                    <div className="mt-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          min="0.01"
                          max={t.amount}
                          step="0.01"
                          placeholder={`Up to ${t.amount.toFixed(2)}`}
                          value={partAmount}
                          onChange={(e) => setPartAmount(e.target.value)}
                          aria-label={`Amount to pay ${t.name}`}
                          className="w-full flex-1 rounded-xl border border-[#d2ceff] bg-[#ffffff] px-3.5 py-2.5 text-[15px] text-[#15151c] outline-none placeholder:text-[#94a3b8] focus:ring-4 focus:ring-[#ffffff]/40"
                        />
                        <button
                          onClick={() => {
                            const n = Math.round(Number(partAmount) * 100) / 100;
                            if (!Number.isFinite(n) || n <= 0 || n > t.amount + 0.005) {
                              setPartError(`Enter an amount up to ${formatMoney(t.amount, currency)}.`);
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
                      {partError && (
                        <p className="mt-1.5 rounded-lg bg-[#ffffff]/15 px-2.5 py-1.5 text-xs font-medium text-white">
                          {partError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setPartFor(t.toId);
                        setPartAmount("");
                        setPartError(null);
                      }}
                      className="mt-1 w-full py-1.5 text-center text-xs font-semibold text-[#e7e5ff] underline decoration-[#b3aaff] underline-offset-2"
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
                <p className="mt-3 text-center text-[11px] font-medium text-[#e7e5ff]">
                  Across the house this turns {vm.pairCount} payments into {vm.planCount}
                </p>
              )}
              <button
                onClick={() => setShowHow(true)}
                className="mt-1 w-full pb-0.5 text-center text-xs font-semibold text-[#e7e5ff] underline underline-offset-2"
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
