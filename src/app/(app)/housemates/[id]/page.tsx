import Link from "next/link";
import { notFound } from "next/navigation";
import { getExpensesAndSplits, getVisiblePaymentDetails, requireHouse } from "@/lib/data";
import { computeBalances } from "@/lib/balances";
import { formatDate, formatMoney } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { PayLinks } from "@/components/payments/PayLinks";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export default async function HousemateProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, house, members } = await requireHouse();

  // Profiles are only viewable inside your own house.
  const member = members.find((m) => m.user_id === id);
  if (!member) notFound();

  const [{ expenses, splits }, payMap] = await Promise.all([
    getExpensesAndSplits(house.id),
    getVisiblePaymentDetails(),
  ]);
  const balances = computeBalances(expenses, splits, user.id);
  const net = round2(balances.netByUser[id] ?? 0);

  const isMe = id === user.id;
  const name = member.profile?.name ?? "Housemate";
  const first = name.trim().split(/\s+/)[0] || "They";
  // RLS already filtered this: a row only comes back if it's mine or shared.
  const pay = payMap.get(id);
  const hasHandles = Boolean(pay && (pay.monzo || pay.paypal || pay.revolut || pay.bank));

  return (
    <div className="space-y-5">
      <Link
        href="/housemates"
        className="inline-flex items-center gap-1 px-1 text-xs font-medium text-slate-500 transition hover:text-slate-700"
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M12 15l-5-5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        All housemates
      </Link>

      {/* Who they are */}
      <div className="card flex items-center gap-4 p-5">
        <Avatar
          name={member.profile?.name}
          color={member.profile?.avatar_color}
          avatarUrl={member.profile?.avatar_url}
          size="xl"
        />
        <div className="min-w-0">
          <p className="truncate text-lg font-bold text-slate-900">
            {isMe ? `${name} (you)` : name}
            {member.role === "admin" && (
              <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                admin
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400">
            {house.name} · joined {formatDate(member.joined_at)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {Math.abs(net) < 0.005 ? (
              <span className="text-slate-400">All settled</span>
            ) : net > 0 ? (
              <span className="text-mint-600">Is owed {formatMoney(net, house.currency)}</span>
            ) : (
              <span className="text-red-600">Owes {formatMoney(-net, house.currency)}</span>
            )}
          </p>
        </div>
      </div>

      {/* Payment methods — only what they've chosen to share */}
      <div className="card p-5">
        <span className="label">Payment methods</span>
        {isMe ? (
          <>
            <p className="mb-3 mt-1 text-xs text-slate-400">
              {hasHandles
                ? pay?.share_with_house
                  ? "This is what your housemates see when they pay you back."
                  : "Hidden — housemates can't see these until you switch sharing on."
                : "You haven't added any payment details yet."}
            </p>
            {hasHandles && pay?.share_with_house && (
              <div className="mb-3 flex flex-wrap gap-2">
                <PayLinks
                  pay={{ monzo: pay.monzo, paypal: pay.paypal, revolut: pay.revolut, bank: pay.bank }}
                />
              </div>
            )}
            <Link href="/settings" className="btn-secondary inline-block px-4 py-2 text-xs">
              Manage in Settings
            </Link>
          </>
        ) : hasHandles ? (
          <>
            <p className="mb-3 mt-1 text-xs text-slate-400">
              {first} shares these with the house so you can pay them back directly — HouseSync
              never touches the money.
            </p>
            <div className="flex flex-wrap gap-2">
              <PayLinks
                pay={{
                  monzo: pay?.monzo ?? null,
                  paypal: pay?.paypal ?? null,
                  revolut: pay?.revolut ?? null,
                  bank: pay?.bank ?? null,
                }}
              />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-slate-500">
            {first} hasn&apos;t shared any payment details with the house. Everyone chooses in
            their own settings whether housemates can see these.
          </p>
        )}
      </div>
    </div>
  );
}
