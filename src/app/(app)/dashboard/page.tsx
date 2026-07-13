import Link from "next/link";
import {
  getAccountSettings,
  getActivity,
  getBills,
  getChores,
  getExpensesAndSplits,
  getHouseCategories,
  getNotices,
  getShoppingItems,
  requireHouse,
} from "@/lib/data";
import { NoticeBoard } from "@/components/notices/NoticeBoard";
import { computeBalances } from "@/lib/balances";
import { getRate } from "@/lib/rates";
import { formatMoney, formatConverted, relativeDay, firstName, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import {
  IconArrowRight,
  IconBroom,
  IconCart,
  IconPlus,
  IconReceipt,
  IconRepeat,
} from "@/components/icons";
import type { MemberWithProfile } from "@/lib/types";
import { SpendingPanel } from "@/components/spending/SpendingPanel";
import { BudgetCard } from "@/components/spending/BudgetCard";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { user, profile, house, members } = await requireHouse();
  const [{ expenses, splits }, bills, chores, activity, categories, account, notices, shopping] =
    await Promise.all([
      getExpensesAndSplits(house.id),
      getBills(house.id),
      getChores(house.id),
      getActivity(house.id, 8),
      getHouseCategories(house.id),
      getAccountSettings(),
      getNotices(house.id),
      getShoppingItems(house.id),
    ]);

  // The user's own share spent in the current calendar month (for the budget).
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const dateById = new Map(expenses.map((e) => [e.id, e.date]));
  let spentThisMonth = 0;
  for (const s of splits) {
    if (s.user_id !== user.id) continue;
    const dt = dateById.get(s.expense_id);
    if (dt && new Date(`${dt}T00:00:00`).getTime() >= startOfMonth) {
      spentThisMonth += Number(s.amount_owed);
    }
  }

  const balances = computeBalances(expenses, splits, user.id);
  const memberOf = (id: string | null): MemberWithProfile | undefined =>
    members.find((m) => m.user_id === id);

  // Optional per-user second currency: shows an approximate "≈ $X" under house
  // totals. Only fetch a rate when the user picked a currency other than the
  // house's; a failed/absent rate just leaves `display` null (no second line).
  const displayCurrency = account?.display_currency ?? null;
  const displayRate =
    displayCurrency && displayCurrency !== house.currency
      ? await getRate(house.currency, displayCurrency)
      : null;
  const display =
    displayCurrency && displayRate ? { currency: displayCurrency, rate: displayRate } : null;

  // Data for the interactive spending explorer (computed client-side per scope).
  const spendExpenses = expenses.map((e) => ({
    id: e.id,
    amount: Number(e.amount),
    category: e.category,
    date: e.date,
  }));
  const spendSplits = splits.map((s) => ({
    expense_id: s.expense_id,
    user_id: s.user_id,
    amount_owed: Number(s.amount_owed),
  }));
  const spendMembers = members.map((m) => ({
    id: m.user_id,
    name: m.profile?.name ?? "Housemate",
    color: m.profile?.avatar_color ?? "#6f53f5",
  }));
  const spendCategories = categories.map((c) => ({
    code: c.code,
    name: c.name,
    emoji: c.emoji,
    color: c.color,
  }));

  const upcomingBills = bills
    .filter((b) => b.active && b.next_due_date)
    .slice(0, 3);

  const choresDue = chores
    .filter((c) => c.status === "todo")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 4);

  // Compact shopping preview: oldest unbought items first (matches /shopping).
  const shoppingToBuy = shopping.filter((i) => !i.checked);
  const shoppingPreview = shoppingToBuy.slice(0, 4);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Hi {firstName(profile?.name)} 👋
        </h1>
        <p className="text-sm text-slate-500">Here&apos;s how {house.name} is doing.</p>
      </div>

      {/* Balance summary */}
      <section className="grid grid-cols-2 gap-3">
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">You owe</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {formatMoney(balances.totalYouOwe, house.currency)}
          </p>
          {display && (
            <p className="mt-0.5 text-xs text-slate-400">
              {formatConverted(balances.totalYouOwe, house.currency, display)}
            </p>
          )}
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">You&apos;re owed</p>
          <p className="mt-1 text-2xl font-bold text-mint-600">
            {formatMoney(balances.totalYouAreOwed, house.currency)}
          </p>
          {display && (
            <p className="mt-0.5 text-xs text-slate-400">
              {formatConverted(balances.totalYouAreOwed, house.currency, display)}
            </p>
          )}
        </div>
      </section>

      {/* Spending explorer */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Spending</h2>
        <BudgetCard
          userId={user.id}
          currency={house.currency}
          spentThisMonth={spentThisMonth}
          initialBudget={account?.monthly_budget ?? null}
        />
        <SpendingPanel
          expenses={spendExpenses}
          splits={spendSplits}
          members={spendMembers}
          categories={spendCategories}
          meId={user.id}
          currency={house.currency}
        />
      </section>

      {/* Per-person breakdown */}
      {balances.pairwise.length > 0 ? (
        <section className="card divide-y divide-slate-100">
          {balances.pairwise.map((p) => {
            const m = memberOf(p.userId);
            return (
              <div key={p.userId} className="flex items-center gap-3 p-3.5">
                <Avatar name={m?.profile?.name} color={m?.profile?.avatar_color} avatarUrl={m?.profile?.avatar_url} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {m?.profile?.name ?? "Housemate"}
                  </p>
                  <p className="text-xs text-slate-500">
                    {p.direction === "you_owe" ? "You owe them" : "Owes you"}
                  </p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${
                      p.direction === "you_owe" ? "text-red-600" : "text-mint-600"
                    }`}
                  >
                    {formatMoney(p.amount, house.currency)}
                  </p>
                  {display && (
                    <p className="text-[11px] text-slate-400">
                      {formatConverted(p.amount, house.currency, display)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
          <Link
            href="/housemates"
            className="flex items-center justify-center gap-1 p-3 text-sm font-semibold text-brand-600 hover:bg-slate-50"
          >
            Settle up <IconArrowRight className="h-4 w-4" />
          </Link>
        </section>
      ) : (
        <section className="card p-4 text-center text-sm text-slate-500">
          You&apos;re all square. Nothing owed either way 🎉
        </section>
      )}

      {/* Quick actions */}
      <section className="grid grid-cols-3 gap-3">
        <QuickAction href="/expenses/new" label="Add expense" Icon={IconPlus} primary />
        <QuickAction href="/bills/new" label="Add bill" Icon={IconRepeat} />
        <QuickAction href="/chores/new" label="Add chore" Icon={IconBroom} />
      </section>

      {/* House noticeboard */}
      <NoticeBoard
        houseId={house.id}
        currentUserId={user.id}
        initialNotices={notices}
        members={members}
      />

      {/* Upcoming bills */}
      <Section title="Upcoming bills" href="/bills" linkLabel="All bills">
        {upcomingBills.length === 0 ? (
          <Empty icon={<IconRepeat className="h-5 w-5" />} text="No recurring bills yet." />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {upcomingBills.map((b) => (
              <li key={b.id} className="flex items-center gap-3 p-3.5">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-brand-600">
                  <IconRepeat className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{b.title}</p>
                  <p className="text-xs text-slate-500">
                    {b.next_due_date ? `Due ${relativeDay(b.next_due_date)}` : b.frequency}
                  </p>
                </div>
                <p className="text-sm font-semibold text-slate-700">
                  {formatMoney(Number(b.amount), house.currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      {/* Shopping list preview */}
      <Section
        title={
          shoppingToBuy.length > 0 ? `Shopping list (${shoppingToBuy.length} to buy)` : "Shopping list"
        }
        href="/shopping"
        linkLabel="Full list"
      >
        {shoppingPreview.length === 0 ? (
          <Empty icon={<IconCart className="h-5 w-5" />} text="Nothing on the shopping list." />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {shoppingPreview.map((i) => {
              const m = memberOf(i.added_by);
              return (
                <li key={i.id} className="flex items-center gap-3 p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-mint-100 text-mint-600">
                    <IconCart className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <span className="truncate">{i.name}</span>
                      {i.quantity && (
                        <span className="chip shrink-0 bg-slate-100 text-slate-500">
                          {i.quantity}
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-500">
                      Added by {m?.profile?.name ?? "a housemate"}
                    </p>
                  </div>
                </li>
              );
            })}
            {shoppingToBuy.length > shoppingPreview.length && (
              <li>
                <Link
                  href="/shopping"
                  className="flex items-center justify-center gap-1 p-3 text-sm font-semibold text-brand-600 hover:bg-slate-50"
                >
                  {shoppingToBuy.length - shoppingPreview.length} more{" "}
                  <IconArrowRight className="h-4 w-4" />
                </Link>
              </li>
            )}
          </ul>
        )}
      </Section>

      {/* Chores due */}
      <Section title="Chores due" href="/chores" linkLabel="All chores">
        {choresDue.length === 0 ? (
          <Empty icon={<IconBroom className="h-5 w-5" />} text="No chores on the rota yet." />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {choresDue.map((c) => {
              const m = memberOf(c.assigned_to);
              const overdue =
                c.due_date && new Date(c.due_date) < new Date(new Date().toDateString());
              return (
                <li key={c.id} className="flex items-center gap-3 p-3.5">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-amber-50 text-amber-600">
                    <IconBroom className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{c.title}</p>
                    <p className="text-xs text-slate-500">
                      {m?.profile?.name ? `${m.profile.name} · ` : ""}
                      {c.due_date ? (
                        <span className={overdue ? "font-medium text-red-500" : ""}>
                          {relativeDay(c.due_date)}
                        </span>
                      ) : (
                        "no due date"
                      )}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      {/* Recent activity */}
      <Section title="Recent activity">
        {activity.length === 0 ? (
          <Empty icon={<IconReceipt className="h-5 w-5" />} text="Nothing has happened yet." />
        ) : (
          <ul className="card divide-y divide-slate-100">
            {activity.map((a) => {
              const m = memberOf(a.user_id);
              return (
                <li key={a.id} className="flex items-center gap-3 p-3.5">
                  <Avatar name={m?.profile?.name} color={m?.profile?.avatar_color} avatarUrl={m?.profile?.avatar_url} size="sm" />
                  <p className="min-w-0 flex-1 text-sm text-slate-700">
                    <span className="font-medium">{m?.profile?.name ?? "Someone"}</span>{" "}
                    {a.message}
                  </p>
                  <span className="shrink-0 text-xs text-slate-400">{timeAgo(a.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function QuickAction({
  href,
  label,
  Icon,
  primary = false,
}: {
  href: string;
  label: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl border p-3 text-center text-xs font-semibold shadow-card transition-colors ${
        primary
          ? "border-brand-600 bg-brand-600 text-white hover:bg-brand-700"
          : "border-slate-100 bg-white text-slate-700 hover:bg-slate-50"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </Link>
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {href && (
          <Link href={href} className="text-xs font-medium text-brand-600 hover:underline">
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="card flex items-center gap-3 p-4 text-sm text-slate-500">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400">
        {icon}
      </span>
      {text}
    </div>
  );
}
