import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, tableCount, msOf, type AdminUserRow } from "@/lib/adminData";
import { ADMIN_BASE } from "@/lib/constants";
import {
  AdminShell,
  Section,
  Grid,
  StatCard,
  Bars,
  AxisLabels,
  BarHeader,
  RankList,
} from "@/components/admin/AdminUI";
import { TestEmail } from "@/components/admin/TestEmail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

type View = {
  path: string;
  referrer: string | null;
  visitor_hash: string | null;
  country: string | null;
  created_at: string;
};

const DAY = 86_400_000;

function last30(): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

function topCounts(items: string[], n: number): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

export default async function AdminOverviewPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const user = gate.user;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={user.email} active="overview">
        <p className="card p-4 text-sm text-slate-600">
          Analytics isn&rsquo;t configured yet: set <code>SUPABASE_SERVICE_ROLE_KEY</code> and reload.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();

  const [
    users,
    profilesRes,
    viewsRes,
    totalViews,
    houses,
    memberships,
    expenses,
    bills,
    chores,
    messages,
    waitlistCountRes,
  ] = await Promise.all([
    listAllUsers(admin),
    admin.from("profiles").select("id, name"),
    admin
      .from("page_views")
      .select("path, referrer, visitor_hash, country, created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(50_000),
    tableCount(admin, "page_views"),
    tableCount(admin, "houses"),
    tableCount(admin, "house_members"),
    tableCount(admin, "expenses"),
    tableCount(admin, "recurring_bills"),
    tableCount(admin, "chores"),
    tableCount(admin, "messages"),
    admin.from("waitlist").select("*", { count: "exact", head: true }),
  ]);

  const waitlistCount = waitlistCountRes.count ?? 0;

  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string | null }[]) {
    if (p.name) nameById.set(p.id, p.name);
  }
  const views = (viewsRes.data ?? []) as View[];

  const now = Date.now();
  const d1 = now - DAY;
  const d7 = now - 7 * DAY;
  const d30 = now - 30 * DAY;
  const days = last30();

  const totalUsers = users.length;
  const signups1 = users.filter((u) => msOf(u.created_at) >= d1).length;
  const signups7 = users.filter((u) => msOf(u.created_at) >= d7).length;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const active7 = users.filter((u) => msOf(u.last_sign_in_at) >= d7).length;
  const recent = [...users].sort((a, b) => msOf(b.created_at) - msOf(a.created_at)).slice(0, 50);

  const signupByDay = new Map(days.map((d) => [d, 0]));
  for (const u of users) {
    if (!u.created_at) continue;
    const k = dayOf(u.created_at);
    if (signupByDay.has(k)) signupByDay.set(k, (signupByDay.get(k) ?? 0) + 1);
  }
  const signupBars = days.map((d) => ({ day: d, value: signupByDay.get(d) ?? 0 }));

  const visits30 = views.length;
  const visits1 = views.filter((v) => msOf(v.created_at) >= d1).length;
  const visits7 = views.filter((v) => msOf(v.created_at) >= d7).length;
  const uniques = (vs: View[]) => new Set(vs.map((v) => v.visitor_hash ?? "")).size;
  const uniques30 = uniques(views);
  const avgPerDay = Math.round(visits30 / 30);

  const visitByDay = new Map(days.map((d) => [d, 0]));
  for (const v of views) {
    const k = dayOf(v.created_at);
    if (visitByDay.has(k)) visitByDay.set(k, (visitByDay.get(k) ?? 0) + 1);
  }
  const visitBars = days.map((d) => ({ day: d, value: visitByDay.get(d) ?? 0 }));

  const topPaths = topCounts(views.map((v) => v.path || "/"), 8);
  const topRefs = topCounts(views.map((v) => v.referrer || "Direct"), 8);
  const topCountries = topCounts(views.map((v) => v.country || "Unknown"), 8);

  return (
    <AdminShell email={user.email} active="overview">
      <Section title="Overview">
        <Grid>
          <StatCard label="Total users" value={totalUsers} sub={`${signups1} new today`} />
          <StatCard label="New sign-ups (7d)" value={signups7} />
          <StatCard label="Active users (7d)" value={active7} />
          <StatCard label="Visits (1d)" value={visits1} />
          <StatCard label="Visits (7d)" value={visits7} sub={`~${Math.round(visits7 / 7)}/day`} />
          <StatCard label="Visits (30d)" value={visits30} sub={`~${avgPerDay}/day`} />
          <StatCard label="Unique visitors (30d)" value={uniques30} />
          <StatCard label="Total houses" value={houses} />
          <StatCard label="Waitlist" value={waitlistCount} />
        </Grid>
      </Section>

      <Section title="Traffic — last 30 days">
        <div className="card space-y-2 p-4">
          <BarHeader
            left={`${visits30} visits`}
            right={`${uniques30} unique · ${visits7} this week · ${visits1} today`}
          />
          <Bars data={visitBars} color="brand" />
          <AxisLabels days={days} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <RankList title="Top pages" rows={topPaths} />
          <RankList title="Top sources" rows={topRefs} />
          <RankList title="Countries" rows={topCountries} />
        </div>
        <p className="text-xs text-slate-400">All-time page views: {totalViews.toLocaleString()}</p>
      </Section>

      <Section
        title="Sign-ups — last 30 days"
        action={
          <Link href={`${ADMIN_BASE}/users`} className="text-xs font-medium text-brand-600 hover:underline">
            View all users →
          </Link>
        }
      >
        <div className="card space-y-2 p-4">
          <BarHeader left={`${signups30} new sign-ups`} right={`${totalUsers} all-time`} />
          <Bars data={signupBars} color="mint" />
          <AxisLabels days={days} />
        </div>
        <div className="card p-0">
          <SignupsTable rows={recent} nameById={nameById} />
        </div>
      </Section>

      <Section title="Engagement — all-time">
        <Grid>
          <StatCard label="Houses" value={houses} />
          <StatCard label="Memberships" value={memberships} />
          <StatCard label="Expenses" value={expenses} />
          <StatCard label="Recurring bills" value={bills} />
          <StatCard label="Chores" value={chores} />
          <StatCard label="Messages" value={messages} />
        </Grid>
      </Section>

      <Section title="Tools">
        <TestEmail />
      </Section>
    </AdminShell>
  );
}

function SignupsTable({ rows, nameById }: { rows: AdminUserRow[]; nameById: Map<string, string> }) {
  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-2.5 font-medium">Email</th>
            <th className="px-4 py-2.5 font-medium">Name</th>
            <th className="px-4 py-2.5 font-medium">Joined</th>
            <th className="px-4 py-2.5 font-medium">Last seen</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-slate-400">
                No sign-ups yet.
              </td>
            </tr>
          ) : (
            rows.map((u) => (
              <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <Link
                    href={`${ADMIN_BASE}/users/${u.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {u.email ?? "—"}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{nameById.get(u.id) ?? "—"}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmt(u.created_at)}</td>
                <td className="px-4 py-2.5 text-slate-500">{fmt(u.last_sign_in_at)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
