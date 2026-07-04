import Link from "next/link";
import { getExpensesAndSplits, getVisiblePaymentDetails, requireHouse } from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { formatMoney, formatDate } from "@/lib/format";
import { PageTitle } from "@/components/app/PageTitle";
import { Avatar } from "@/components/Avatar";
import { InviteBox } from "@/components/house/InviteBox";
import { SettleActions, type SettleVM } from "@/components/housemates/SettleActions";

export const metadata = { title: "Housemates" };
export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default async function HousematesPage() {
  const { user, house, members } = await requireHouse();
  const [{ expenses, splits }, payMap] = await Promise.all([
    getExpensesAndSplits(house.id),
    getVisiblePaymentDetails(),
  ]);
  const balances = computeBalances(expenses, splits, user.id);

  const profileOf = (id: string) => members.find((m) => m.user_id === id)?.profile;
  const nameOf = (id: string) =>
    id === user.id ? "You" : profileOf(id)?.name ?? "Housemate";

  // Build directional settle view-models from raw splits.
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  const me = user.id;
  const vmMap: Record<string, SettleVM> = {};
  const ensure = (uid: string): SettleVM =>
    (vmMap[uid] ??= {
      userId: uid,
      name: profileOf(uid)?.name ?? "Housemate",
      color: profileOf(uid)?.avatar_color ?? "#6f53f5",
      owe: 0,
      owePending: 0,
      owed: 0,
      owedPending: 0,
      markPaidIds: [],
      confirmIds: [],
      // RLS only returns rows the housemate has chosen to share.
      pay: {
        monzo: payMap.get(uid)?.monzo ?? null,
        paypal: payMap.get(uid)?.paypal ?? null,
        revolut: payMap.get(uid)?.revolut ?? null,
      },
    });

  for (const s of splits) {
    if (s.status === "confirmed") continue;
    const payer = payerOf.get(s.expense_id) ?? null;
    if (!payer) continue;
    const amt = Number(s.amount_owed);
    if (s.user_id === me && payer !== me) {
      const vm = ensure(payer);
      if (s.status === "unpaid") {
        vm.owe += amt;
        vm.markPaidIds.push(s.id);
      } else if (s.status === "paid") {
        vm.owePending += amt;
      }
    } else if (payer === me && s.user_id !== me) {
      const vm = ensure(s.user_id);
      if (s.status === "unpaid") {
        vm.owed += amt;
      } else if (s.status === "paid") {
        vm.owedPending += amt;
        vm.confirmIds.push(s.id);
      }
    }
  }

  const settleItems = Object.values(vmMap)
    .map((vm) => ({
      ...vm,
      owe: round2(vm.owe),
      owePending: round2(vm.owePending),
      owed: round2(vm.owed),
      owedPending: round2(vm.owedPending),
    }))
    .filter((vm) => vm.owe + vm.owePending + vm.owed + vm.owedPending > 0.004)
    .sort((a, b) => b.owe + b.owePending - (a.owe + a.owePending));

  return (
    <div className="space-y-6">
      <PageTitle title={house.name} subtitle={`${members.length} housemates`} />

      {/* Settle up */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Settle up</h2>
        <SettleActions
          items={settleItems}
          houseId={house.id}
          currentUserId={user.id}
          currency={house.currency}
        />
      </section>

      {/* Members */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Everyone</h2>
        <ul className="card divide-y divide-slate-100">
          {members.map((m) => {
            const net = round2(balances.netByUser[m.user_id] ?? 0);
            return (
              <li key={m.user_id}>
                <Link
                  href={`/housemates/${m.user_id}`}
                  className="flex items-center gap-3 p-3.5 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                >
                  <Avatar name={m.profile?.name} color={m.profile?.avatar_color} avatarUrl={m.profile?.avatar_url} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {nameOf(m.user_id)}
                      {m.role === "admin" && (
                        <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                          admin
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400">Joined {formatDate(m.joined_at)}</p>
                  </div>
                  <div className="shrink-0 text-right text-sm font-medium">
                    {Math.abs(net) < 0.005 ? (
                      <span className="text-slate-400">settled</span>
                    ) : net > 0 ? (
                      <span className="text-mint-600">
                        is owed {formatMoney(net, house.currency)}
                      </span>
                    ) : (
                      <span className="text-red-600">owes {formatMoney(-net, house.currency)}</span>
                    )}
                  </div>
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 shrink-0 text-slate-300" aria-hidden="true">
                    <path d="M8 5l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
        <p className="px-1 text-xs text-slate-400">
          Balances are shown neutrally, it&apos;s about keeping the house clear, not keeping score.
        </p>
      </section>

      {/* Invite */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Invite a housemate</h2>
        <div className="card p-4">
          <InviteBox code={house.invite_code} houseName={house.name} />
        </div>
      </section>
    </div>
  );
}
