import { getBills, getExpensesAndSplits, getSettlements, requireHouse } from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { netCents, buildPlan } from "@/lib/settle";
import { formatMoney, ukToday } from "@/lib/format";
import { SearchClient, type SearchShortcut } from "@/components/search/SearchClient";

export const metadata = { title: "Search" };
export const dynamic = "force-dynamic";

// The shortcuts under the empty search box carry live numbers, so the screen
// is useful before anyone types. Same balance maths as the dashboard.
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { user, house } = await requireHouse();
  const { q: rawQ } = await searchParams;
  const q = Array.isArray(rawQ) ? rawQ[0] : rawQ;
  const simplified = house.settle_mode === "simplified";
  const [{ expenses, splits }, bills, settlements] = await Promise.all([
    getExpensesAndSplits(house.id),
    getBills(house.id),
    simplified ? getSettlements(house.id) : Promise.resolve([]),
  ]);

  // People you still have something to settle with, counted the way the
  // Housemates page counts its rows so the two screens cannot disagree.
  const balances = computeBalances(expenses, splits, user.id, settlements);
  const myPlan = simplified
    ? buildPlan(netCents(expenses, splits, settlements)).filter(
        (t) => t.from === user.id || t.to === user.id,
      )
    : [];
  // A settlement waiting on someone's confirm nets to zero and so drops out
  // of the plan, but houseIsSquare still counts the house as unsettled and
  // Housemates still shows a Confirm button for it.
  const myPending = settlements.filter(
    (s) =>
      !s.absorbed &&
      s.status === "pending" &&
      (s.from_user === user.id || s.to_user === user.id),
  );
  const settleCount = simplified
    ? new Set([
        ...myPlan.map((t) => (t.from === user.id ? t.to : t.from)),
        ...myPending.map((s) => (s.from_user === user.id ? s.to_user : s.from_user)),
      ]).size
    : balances.counterparties.length;

  // Your share this calendar month (same rule as the dashboard budget card).
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const dateById = new Map(expenses.map((e) => [e.id, e.date]));
  let spent = 0;
  for (const s of splits) {
    if (s.user_id !== user.id) continue;
    const dt = dateById.get(s.expense_id);
    if (dt && new Date(`${dt}T00:00:00`).getTime() >= startOfMonth) spent += Number(s.amount_owed);
  }

  // Bills falling due in the next 7 days. The server runs in UTC, so the
  // window is anchored to the UK calendar rather than the server's own: a
  // plain toISOString() still reads as yesterday between midnight and 1am
  // British Summer Time. Week out is then pure calendar arithmetic, which
  // no clock change can shift.
  const todayIso = ukToday();
  const weekOutDate = new Date(`${todayIso}T00:00:00Z`);
  weekOutDate.setUTCDate(weekOutDate.getUTCDate() + 7);
  const weekOut = weekOutDate.toISOString().slice(0, 10);
  const dueDates = bills
    .filter((b) => b.active)
    .map((b) => b.next_due_date)
    .filter((d): d is string => Boolean(d));
  // Nothing rolls a missed bill forward on its own, so an unlogged one keeps
  // a past due date indefinitely. Counting only the week ahead hid exactly
  // the bills that need attention most, under the word "Nothing".
  const overdue = dueDates.filter((d) => d < todayIso).length;
  const dueSoon = dueDates.filter((d) => d >= todayIso && d <= weekOut).length;

  const shortcuts: SearchShortcut[] = [
    {
      href: "/housemates",
      title: "Settle up",
      detail:
        settleCount === 0
          ? "All square with everyone"
          : `${settleCount} ${settleCount === 1 ? "person" : "people"} to sort out`,
      tone: "brand",
    },
    {
      href: "/insights",
      title: "This month",
      detail: `${formatMoney(spent, house.currency)} is your share so far`,
      tone: "mint",
    },
    {
      href: "/bills",
      title: overdue > 0 ? "Bills overdue" : "Bills due soon",
      detail:
        overdue > 0
          ? `${overdue} overdue${dueSoon > 0 ? `, ${dueSoon} due this week` : ""}`
          : dueSoon > 0
            ? `${dueSoon} due in the next 7 days`
            : "Nothing due in the next 7 days",
      tone: "amber",
    },
  ];

  return (
    <SearchClient
      houseName={house.name}
      currency={house.currency}
      shortcuts={shortcuts}
      initialQuery={q ?? ""}
    />
  );
}
