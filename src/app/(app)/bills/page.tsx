import Link from "next/link";
import { getBills, getSplitsForExpenses, requireHouse } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/app/PageTitle";
import { LogBillButton } from "@/components/bills/LogBillButton";
import { BillPay } from "@/components/bills/BillPay";
import { Avatar } from "@/components/Avatar";
import { IconPlus } from "@/components/icons";
import { formatMoney } from "@/lib/format";
import { splitEqually } from "@/lib/balances";
import { EXPENSE_CATEGORIES, type Expense, type ExpenseSplit, type SplitStatus } from "@/lib/types";

export const metadata = { title: "Bills" };
export const dynamic = "force-dynamic";

const EMOJI = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c.value, c.emoji]));

function dueLabel(next: string | null): { text: string; tone: "muted" | "soon" | "over" } {
  if (!next) return { text: "", tone: "muted" };
  const d = new Date(`${next}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { text: `Overdue by ${-days} day${days === -1 ? "" : "s"}`, tone: "over" };
  if (days === 0) return { text: "Due today", tone: "soon" };
  if (days === 1) return { text: "Due tomorrow", tone: "soon" };
  if (days <= 5) return { text: `Due in ${days} days`, tone: "soon" };
  return {
    text: `Due ${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
    tone: "muted",
  };
}

export default async function BillsPage() {
  const { user, house, members } = await requireHouse();
  const bills = await getBills(house.id);
  const memberIds = members.map((m) => m.user_id);
  const profileOf = (id: string | null) => members.find((m) => m.user_id === id)?.profile ?? null;
  const nameOf = (id: string | null) =>
    id === user.id ? "You" : profileOf(id)?.name ?? "Housemate";

  // Latest requested expense per bill + its splits = the current cycle's status.
  const latestByBill = new Map<string, Expense>();
  const splitsByExpense = new Map<string, ExpenseSplit[]>();
  if (bills.length > 0) {
    const supabase = await createClient();
    const { data: exps } = await supabase
      .from("expenses")
      .select("*")
      .in(
        "bill_id",
        bills.map((b) => b.id),
      )
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    for (const e of (exps ?? []) as Expense[]) {
      if (e.bill_id && !latestByBill.has(e.bill_id)) latestByBill.set(e.bill_id, e);
    }
    const splits = await getSplitsForExpenses([...latestByBill.values()].map((e) => e.id));
    for (const s of splits) {
      const arr = splitsByExpense.get(s.expense_id) ?? [];
      arr.push(s);
      splitsByExpense.set(s.expense_id, arr);
    }
  }

  return (
    <div>
      <PageTitle
        title="Bills"
        subtitle="Request everyone's share and see who's paid at a glance."
        action={
          <Link href="/bills/new" className="btn-primary px-3 py-2 text-sm">
            <IconPlus className="h-4 w-4" /> Add
          </Link>
        }
      />

      {bills.length === 0 ? (
        <div className="card mt-2 flex flex-col items-center p-8 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-3xl">🧾</div>
          <h2 className="mt-3 font-semibold text-slate-900">No bills yet</h2>
          <p className="mt-1 max-w-xs text-sm text-slate-500">
            Add a bill like council tax, energy or Wi-Fi. We&apos;ll split it and let you request
            everyone&apos;s share in a tap.
          </p>
          <Link href="/bills/new" className="btn-primary mt-5">
            Add your first bill
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {bills.map((b) => {
            const latest = latestByBill.get(b.id);
            const splits = latest ? splitsByExpense.get(latest.id) ?? [] : [];
            const requested = splits.length > 0;
            const payer = latest?.paid_by ?? b.paid_by;
            const perShare = splitEqually(Number(b.amount), Math.max(1, memberIds.length))[0] ?? 0;
            const paidCount = splits.filter((s) => s.status !== "unpaid").length;
            const settled = requested && splits.every((s) => s.user_id === payer || s.status !== "unpaid");
            const due = dueLabel(b.next_due_date);
            const mine = splits.find((s) => s.user_id === user.id);

            return (
              <li key={b.id} className="card p-4">
                {/* Header */}
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-lg">
                    {EMOJI[b.category] ?? "💡"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium text-slate-900">{b.title}</p>
                      <p className="shrink-0 font-semibold text-slate-800">
                        {formatMoney(Number(b.amount), house.currency)}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      <span className="capitalize">{b.frequency}</span> ·{" "}
                      {formatMoney(perShare, house.currency)} each
                      {due.text ? (
                        <>
                          {" · "}
                          <span
                            className={
                              due.tone === "over"
                                ? "font-medium text-red-600"
                                : due.tone === "soon"
                                  ? "font-medium text-amber-600"
                                  : ""
                            }
                          >
                            {due.text}
                          </span>
                        </>
                      ) : null}
                    </p>
                  </div>
                </div>

                {/* Current cycle: who's paid */}
                {requested && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <div className="mb-2 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">
                        {paidCount} of {splits.length} paid
                      </span>
                      <span className="text-slate-400">
                        paid by {payer === user.id ? "you" : nameOf(payer)}
                      </span>
                    </div>
                    <ul className="space-y-1.5">
                      {splits.map((s) => {
                        const prof = profileOf(s.user_id);
                        return (
                          <li key={s.id} className="flex items-center gap-2 text-sm">
                            <Avatar
                              name={prof?.name}
                              color={prof?.avatar_color}
                              avatarUrl={prof?.avatar_url}
                              size="sm"
                            />
                            <span className="min-w-0 flex-1 truncate text-slate-700">
                              {nameOf(s.user_id)}
                            </span>
                            <span className="text-slate-500">
                              {formatMoney(Number(s.amount_owed), house.currency)}
                            </span>
                            <StatusBadge status={s.status} isPayer={s.user_id === payer} />
                          </li>
                        );
                      })}
                    </ul>

                    {mine && mine.status === "unpaid" && mine.user_id !== payer && (
                      <div className="mt-3">
                        <BillPay
                          splitId={mine.id}
                          amount={Number(mine.amount_owed)}
                          payerName={nameOf(payer)}
                          payerPay={{
                            monzo: profileOf(payer)?.pay_monzo ?? null,
                            paypal: profileOf(payer)?.pay_paypal ?? null,
                            revolut: profileOf(payer)?.pay_revolut ?? null,
                            bank: profileOf(payer)?.pay_bank ?? null,
                          }}
                          houseId={house.id}
                          currentUserId={user.id}
                          currency={house.currency}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Request (first time) or start the next cycle once everyone's paid */}
                {(!requested || settled) && (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-400">
                      {settled
                        ? "All settled 🎉 — ready for the next cycle"
                        : `Split ${memberIds.length} ${memberIds.length === 1 ? "way" : "ways"}`}
                    </span>
                    <LogBillButton
                      bill={b}
                      memberIds={memberIds}
                      currentUserId={user.id}
                      currency={house.currency}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function StatusBadge({ status, isPayer }: { status: SplitStatus; isPayer: boolean }) {
  if (isPayer) return <span className="chip bg-slate-100 text-slate-500">paid provider</span>;
  if (status === "confirmed") return <span className="chip bg-mint-50 text-mint-700">paid</span>;
  if (status === "paid") return <span className="chip bg-amber-50 text-amber-700">awaiting</span>;
  return <span className="chip bg-red-50 text-red-600">unpaid</span>;
}
