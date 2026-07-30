import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { Avatar } from "@/components/Avatar";
import { ADMIN_BASE } from "@/lib/constants";
import { formatMoney } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "House", robots: { index: false, follow: false } };

const DAY = 86_400_000;

type House = {
  id: string;
  name: string;
  currency: string;
  rent_due_day: number | null;
  address_nickname: string | null;
  invite_code: string;
  created_by: string | null;
  created_at: string;
};
type MemberRow = { user_id: string; role: string; joined_at: string };
type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";

/** "3 days ago" for a quick read on whether a house has gone quiet. */
function relTime(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  return `${Math.round(mo / 12)} year${Math.round(mo / 12) === 1 ? "" : "s"} ago`;
}

export default async function HouseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const { id } = await params;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="houses">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to view houses.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const countIn = (table: string) =>
    admin.from(table).select("*", { count: "exact", head: true }).eq("house_id", id);

  const [
    houseRes,
    membersRes,
    amountsRes,
    expenses,
    bills,
    chores,
    messages,
    shopping,
    notices,
    lastMsgRes,
    lastExpRes,
  ] = await Promise.all([
    admin
      .from("houses")
      .select("id, name, currency, rent_due_day, address_nickname, invite_code, created_by, created_at")
      .eq("id", id)
      .maybeSingle(),
    admin.from("house_members").select("user_id, role, joined_at").eq("house_id", id),
    admin.from("expenses").select("amount").eq("house_id", id).limit(10_000),
    countIn("expenses"),
    countIn("recurring_bills"),
    countIn("chores"),
    countIn("messages"),
    countIn("shopping_items"),
    countIn("notices"),
    admin
      .from("messages")
      .select("created_at")
      .eq("house_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("expenses")
      .select("created_at")
      .eq("house_id", id)
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  const house = (houseRes.data ?? null) as House | null;
  if (!house) notFound();

  const memberRows = (membersRes.data ?? []) as MemberRow[];

  // Profiles for the member list, plus the creator (who may have since left).
  const wantedIds = [...new Set([...memberRows.map((m) => m.user_id), house.created_by ?? ""])].filter(
    Boolean,
  );
  let profiles = new Map<string, ProfileRow>();
  if (wantedIds.length) {
    const { data } = await admin
      .from("profiles")
      .select("id, name, email, avatar_url, avatar_color")
      .in("id", wantedIds);
    profiles = new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
  }

  const totalSpend = ((amountsRes.data ?? []) as { amount: number | string }[]).reduce(
    (s, r) => s + Number(r.amount ?? 0),
    0,
  );

  const lastMsg = (lastMsgRes.data ?? [])[0]?.created_at as string | undefined;
  const lastExp = (lastExpRes.data ?? [])[0]?.created_at as string | undefined;
  const lastActive = [lastMsg, lastExp]
    .filter(Boolean)
    .sort((a, b) => new Date(b!).getTime() - new Date(a!).getTime())[0];

  const creator = house.created_by ? profiles.get(house.created_by) : null;

  return (
    <AdminShell email={gate.user.email} active="houses">
      <div>
        <Link href={`${ADMIN_BASE}/houses`} className="text-sm text-slate-400 hover:text-slate-600">
          ← All houses
        </Link>
      </div>

      <Section title="House">
        <div className="card p-5">
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold text-slate-900">{house.name}</h1>
            {house.address_nickname && (
              <p className="truncate text-sm text-slate-500">{house.address_nickname}</p>
            )}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Created" value={fmt(house.created_at)} />
            <Field
              label="Created by"
              value={creator?.name || creator?.email || (house.created_by ? "Deleted user" : "-")}
            />
            <Field label="Currency" value={house.currency} />
            <Field
              label="Rent due day"
              value={house.rent_due_day ? `${house.rent_due_day}` : "Not set"}
            />
            <Field label="Invite code" value={house.invite_code} mono />
            <Field
              label="Last active"
              value={lastActive ? `${relTime(lastActive)} · ${fmt(lastActive)}` : "No activity yet"}
            />
            <Field label="House ID" value={house.id} mono wide />
          </dl>
        </div>
      </Section>

      <Section title="Activity">
        <Grid>
          <StatCard label="Housemates" value={memberRows.length} />
          <StatCard
            label="Expenses"
            value={expenses.count ?? 0}
            sub={totalSpend > 0 ? `${formatMoney(totalSpend, house.currency)} tracked` : undefined}
          />
          <StatCard label="Recurring bills" value={bills.count ?? 0} />
          <StatCard label="Chores" value={chores.count ?? 0} />
          <StatCard label="Messages" value={messages.count ?? 0} />
          <StatCard label="Shopping items" value={shopping.count ?? 0} />
          <StatCard label="Notices" value={notices.count ?? 0} />
        </Grid>
      </Section>

      <Section title={`Housemates (${memberRows.length})`}>
        <div className="card divide-y divide-slate-100 p-0">
          {memberRows.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Nobody is in this house.</p>
          ) : (
            [...memberRows]
              .sort((a, b) => new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime())
              .map((m) => {
                const p = profiles.get(m.user_id);
                const name = p?.name ?? "Unknown";
                return (
                  <div key={m.user_id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar
                        name={name}
                        color={p?.avatar_color ?? "#6f53f5"}
                        avatarUrl={p?.avatar_url ?? null}
                      />
                      <div className="min-w-0">
                        <Link
                          href={`${ADMIN_BASE}/users/${m.user_id}`}
                          className="block truncate text-sm font-medium text-brand-700 hover:underline"
                        >
                          {name}
                        </Link>
                        <p className="truncate text-xs text-slate-400">
                          {p?.email ?? "-"} · joined {fmt(m.joined_at)}
                        </p>
                      </div>
                    </div>
                    <span className="chip shrink-0 bg-slate-100 text-slate-500">{m.role}</span>
                  </div>
                );
              })
          )}
        </div>
      </Section>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-4" : ""}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-700 ${mono ? "select-all break-all font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
