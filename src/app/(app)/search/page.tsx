import { getBills, getExpensesAndSplits, getSettlements, requireHouse } from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { netCents, buildPlan } from "@/lib/settle";
import { formatMoney } from "@/lib/format";
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

  // People you still have something to settle with.
  const balances = computeBalances(expenses, splits, user.id, settlements);
  const settleCount = simplified
    ? buildPlan(netCents(expenses, splits, settlements)).filter((t) => t.from === user.id || t.to === user.id).length
    : balances.pairwise.length;

  // Your share this calendar month (same rule as the dashboard budget card).
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const dateById = new Map(expenses.map((e) => [e.id, e.date]));
  let spent = 0;
  for (const s of splits) {
    if (s.user_id !== user.id) continue;
    const dt = dateById.get(s.expense_id);
    if (dt && new Date(`${dt}T00:00:00`).getTime() >= startOfMonth) spent += Number(s.amount_owed);
  }

  // Bills falling due in the next 7 days.
  const today = new Date();
  const weekOut = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7).toISOString().slice(0, 10);
  const todayIso = today.toISOString().slice(0, 10);
  const dueSoon = bills.filter(
    (b) => b.active && b.next_due_date && b.next_due_date >= todayIso && b.next_due_date <= weekOut,
  ).length;

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
      title: "Bills due soon",
      detail: dueSoon === 0 ? "Nothing due in the next 7 days" : `${dueSoon} due in the next 7 days`,
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
