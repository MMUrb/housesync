import Link from "next/link";
import {
  getActivity,
  getBills,
  getChores,
  getExpensesAndSplits,
  requireHouse,
} from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { formatMoney, relativeDay, firstName, timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import {
  IconArrowRight,
  IconBroom,
  IconPlus,
  IconReceipt,
  IconRepeat,
} from "@/components/icons";
import { EXPENSE_CATEGORIES, type MemberWithProfile } from "@/lib/types";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const CAT_COLOR: Record<string, string> = {
  rent: "#6f53f5",
  bills: "#3f9fe0",
  groceries: "#1bb27e",
  cleaning: "#e0b53f",
  furniture: "#e0567f",
  other: "#94a3b8",
};
const CAT_LABEL: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
);
const DAY = 86_400_000;

export default async function DashboardPage() {
  const { user, profile, house, members } = await requireHouse();
  const [{ expenses, splits }, bills, chores, activity] = await Promise.all([
    getExpensesAndSplits(house.id),
    getBills(house.id),
    getChores(house.id),
    getActivity(house.id, 8),
  ]);

  const balances = computeBalances(expenses, splits, user.id);
  const memberOf = (id: string | null): MemberWithProfile | undefined =>
    members.find((m) => m.user_id === id);

  // Personal spending insights — the user's own share of expenses over time
  // and by category. "This month" is the calendar month; week/day are rolling.
  const expenseById = new Map(expenses.map((e) => [e.id, e]));
  const nowD = new Date();
  const startOfMonth = new Date(nowD.getFullYear(), nowD.getMonth(), 1).getTime();
  const weekAgo = Date.now() - 7 * DAY;
  const monthAgo = Date.now() - 30 * DAY;
  let spendMonth = 0;
  let spendWeek = 0;
  let spend30 = 0;
  const byCat: Record<string, number> = {};
  for (const s of splits) {
    if (s.user_id !== user.id) continue;
    const e = expenseById.get(s.expense_id);
    if (!e) continue;
    const amt = Number(s.amount_owed) || 0;
    const t = new Date(`${e.date}T00:00:00`).getTime();
    if (t >= startOfMonth) spendMonth += amt;
    if (t >= weekAgo) spendWeek += amt;
    if (t >= monthAgo) {
      spend30 += amt;
      byCat[e.category] = (byCat[e.category] ?? 0) + amt;
    }
  }
  const avgDay = spend30 / 30;
  const catSegments = Object.entries(byCat)
    .map(([code, amount]) => ({
      code,
      amount,
      label: CAT_LABEL[code] ?? code,
      color: CAT_COLOR[code] ?? "#94a3b8",
    }))
    .sort((a, b) => b.amount - a.amount);

  const upcomingBills = bills
    .filter((b) => b.active && b.next_due_date)
    .slice(0, 3);

  const choresDue = chores
    .filter((c) => c.status === "todo")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 4);

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
        </div>
        <div className="card p-4">
          <p className="text-xs font-medium text-slate-500">You&apos;re owed</p>
          <p className="mt-1 text-2xl font-bold text-mint-600">
            {formatMoney(balances.totalYouAreOwed, house.currency)}
          </p>
        </div>
      </section>

      {/* Your spending */}
      <section className="space-y-2">
        <h2 className="px-1 text-sm font-semibold text-slate-900">Your spending</h2>
        <div className="card p-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-slate-900">
                {formatMoney(spendMonth, house.currency)}
              </p>
              <p className="text-[11px] text-slate-500">This month</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {formatMoney(spendWeek, house.currency)}
              </p>
              <p className="text-[11px] text-slate-500">This week</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">
                {formatMoney(avgDay, house.currency)}
              </p>
              <p className="text-[11px] text-slate-500">Per day (avg)</p>
            </div>
          </div>

          {spend30 > 0 ? (
            <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-4">
              <SpendingDonut segments={catSegments} total={spend30} currency={house.currency} />
              <ul className="min-w-0 flex-1 space-y-1.5">
                {catSegments.map((c) => (
                  <li key={c.code} className="flex items-center gap-2 text-sm">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="min-w-0 flex-1 truncate text-slate-600">{c.label}</span>
                    <span className="font-medium text-slate-800">
                      {formatMoney(c.amount, house.currency)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-3 border-t border-slate-100 pt-3 text-center text-xs text-slate-400">
              Add an expense to see where your money goes.
            </p>
          )}
        </div>
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
                <p
                  className={`text-sm font-semibold ${
                    p.direction === "you_owe" ? "text-red-600" : "text-mint-600"
                  }`}
                >
                  {formatMoney(p.amount, house.currency)}
                </p>
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

function SpendingDonut({
  segments,
  total,
  currency,
}: {
  segments: { color: string; amount: number }[];
  total: number;
  currency: string;
}) {
  let offset = 0;
  return (
    <div className="relative h-28 w-28 shrink-0">
      <svg viewBox="0 0 36 36" className="h-28 w-28 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.6"
          className="text-slate-100 dark:text-white/10"
        />
        {segments.map((s, i) => {
          const pct = total > 0 ? (s.amount / total) * 100 : 0;
          const el = (
            <circle
              key={i}
              cx="18"
              cy="18"
              r="15.9155"
              fill="none"
              stroke={s.color}
              strokeWidth="3.6"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={`${-offset}`}
            />
          );
          offset += pct;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold text-slate-900">{formatMoney(total, currency)}</span>
        <span className="text-[9px] uppercase tracking-wide text-slate-400">30 days</span>
      </div>
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
