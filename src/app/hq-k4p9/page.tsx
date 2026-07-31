import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, tableCount, countSince, msOf, type AdminUserRow } from "@/lib/adminData";
import {
  DAY,
  lastNDays,
  bucketByDay,
  recentActions,
  activeUsers,
  activeHouses,
} from "@/lib/adminMetrics";
import { ADMIN_BASE } from "@/lib/constants";
import {
  AdminShell,
  Section,
  Grid,
  StatCard,
  Bars,
  AxisLabels,
  BarHeader,
} from "@/components/admin/AdminUI";
import { TestEmail } from "@/components/admin/TestEmail";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

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
  const now = Date.now();
  const since1 = new Date(now - DAY).toISOString();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [
    users,
    profilesRes,
    actions,
    visits1,
    visits7,
    visits30,
    houses,
    memberships,
    expenses,
    bills,
    chores,
    messages,
  ] = await Promise.all([
    listAllUsers(admin),
    admin.from("profiles").select("id, name"),
    recentActions(admin, since30),
    countSince(admin, "page_views", since1),
    countSince(admin, "page_views", since7),
    countSince(admin, "page_views", since30),
    tableCount(admin, "houses"),
    tableCount(admin, "house_members"),
    tableCount(admin, "expenses"),
    tableCount(admin, "recurring_bills"),
    tableCount(admin, "chores"),
    tableCount(admin, "messages"),
  ]);

  // Best-effort: error_logs may not exist until its migration has run.
  const errUnresolvedRes = await admin
    .from("error_logs")
    .select("id", { count: "exact", head: true })
    .is("resolved_at", null);
  const errUnresolved = errUnresolvedRes.count ?? 0;

  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string | null }[]) {
    if (p.name) nameById.set(p.id, p.name);
  }

  const d1 = now - DAY;
  const d7 = now - 7 * DAY;
  const d30 = now - 30 * DAY;
  const days = lastNDays(30);

  const totalUsers = users.length;
  const signups1 = users.filter((u) => msOf(u.created_at) >= d1).length;
  const signups7 = users.filter((u) => msOf(u.created_at) >= d7).length;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const recent = [...users].sort((a, b) => msOf(b.created_at) - msOf(a.created_at)).slice(0, 25);

  const signupBars = bucketByDay(
    users.filter((u) => u.created_at).map((u) => ({ created_at: u.created_at as string })),
    days,
  );

  const dau = activeUsers(actions.rows, d1).size;
  const wau = activeUsers(actions.rows, d7).size;
  const mau = activeUsers(actions.rows, d30).size;
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;
  const housesActive30 = activeHouses(actions.rows, d30).size;

  return (
    <AdminShell email={user.email} active="overview">
      <Section title="At a glance · last 30 days">
        <Grid>
          <StatCard label="Total users" value={totalUsers} sub={`${signups1} new today`} />
          <StatCard label="New sign-ups (30d)" value={signups30} sub={`${signups7} this week`} />
          <StatCard label="Active today" value={dau} sub="did something in-app" />
          <StatCard label="Active (30d)" value={mau} sub={`${stickiness}% stickiness`} />
          <StatCard label="Houses" value={houses} sub={`${housesActive30} active`} />
          <StatCard
            label="Errors (unresolved)"
            value={errUnresolved}
            sub={errUnresolved > 0 ? "needs a look" : "all clear"}
          />
        </Grid>
        {actions.capped && (
          <p className="text-xs text-amber-600">
            Activity volume has outgrown the 30-day sample, so the active-user figures above
            cover only the most recent slice. Worth moving these to a SQL aggregate.
          </p>
        )}
      </Section>

      <Section
        title="Sign-ups · last 30 days"
        action={
          <Link
            href={`${ADMIN_BASE}/acquisition`}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Full acquisition report →
          </Link>
        }
      >
        <div className="card space-y-2 p-4">
          <BarHeader left={`${signups30} new sign-ups`} right={`${totalUsers} all-time`} />
          <Bars data={signupBars} color="mint" />
          <AxisLabels days={days} />
        </div>
      </Section>

      <Section title="Traffic">
        <Grid>
          <StatCard label="Visits (1d)" value={visits1} />
          <StatCard label="Visits (7d)" value={visits7} sub={`~${Math.round(visits7 / 7)}/day`} />
          <StatCard
            label="Visits (30d)"
            value={visits30}
            sub={`~${Math.round(visits30 / 30)}/day`}
          />
        </Grid>
      </Section>

      <Section
        title="Newest sign-ups"
        action={
          <Link
            href={`${ADMIN_BASE}/directory`}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Open directory →
          </Link>
        }
      >
        <div className="card p-0">
          <SignupsTable rows={recent} nameById={nameById} />
        </div>
      </Section>

      <Section title="Engagement · all-time">
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
    iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }) : "-";
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
                    href={`${ADMIN_BASE}/directory/u/${u.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {u.email ?? "-"}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{nameById.get(u.id) ?? "-"}</td>
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
