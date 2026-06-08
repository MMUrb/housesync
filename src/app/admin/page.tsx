import "server-only";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/data";
import { isAdminEmail, hasAdminAllowlist } from "@/lib/admin";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin", robots: { index: false, follow: false } };

type AdminClient = ReturnType<typeof createAdminClient>;
type UserRow = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
};
type Bucket = { day: string; value: number };
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
const ms = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

async function tableCount(admin: AdminClient, table: string): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

async function listAllUsers(admin: AdminClient): Promise<UserRow[]> {
  const all: UserRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    all.push(
      ...users.map((u) => ({
        id: u.id,
        email: u.email ?? undefined,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    );
    if (users.length < 1000) break;
  }
  return all;
}

function topCounts(items: string[], n: number): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) {
    // Signed in but not on the allowlist — show their exact account email so
    // they know precisely what to put in ADMIN_EMAILS. No data is exposed.
    return <NoAccess email={user.email} configured={hasAdminAllowlist} />;
  }

  if (!isAdminConfigured) {
    return (
      <Shell email={user.email}>
        <p className="card p-4 text-sm text-slate-600">
          Analytics isn&rsquo;t configured yet: set <code>SUPABASE_SERVICE_ROLE_KEY</code> in your
          environment and reload.
        </p>
      </Shell>
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
  ]);

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

  // --- Users / sign-ups ---
  const totalUsers = users.length;
  const signups1 = users.filter((u) => ms(u.created_at) >= d1).length;
  const signups7 = users.filter((u) => ms(u.created_at) >= d7).length;
  const signups30 = users.filter((u) => ms(u.created_at) >= d30).length;
  const active7 = users.filter((u) => ms(u.last_sign_in_at) >= d7).length;
  const recent = [...users].sort((a, b) => ms(b.created_at) - ms(a.created_at)).slice(0, 50);

  const signupByDay = new Map(days.map((d) => [d, 0]));
  for (const u of users) {
    if (!u.created_at) continue;
    const k = dayOf(u.created_at);
    if (signupByDay.has(k)) signupByDay.set(k, (signupByDay.get(k) ?? 0) + 1);
  }
  const signupBars: Bucket[] = days.map((d) => ({ day: d, value: signupByDay.get(d) ?? 0 }));

  // --- Traffic ---
  const visits30 = views.length;
  const visits1 = views.filter((v) => ms(v.created_at) >= d1).length;
  const visits7 = views.filter((v) => ms(v.created_at) >= d7).length;
  const uniques = (vs: View[]) => new Set(vs.map((v) => v.visitor_hash ?? "")).size;
  const uniques30 = uniques(views);
  const avgPerDay = Math.round(visits30 / 30);

  const visitByDay = new Map(days.map((d) => [d, 0]));
  for (const v of views) {
    const k = dayOf(v.created_at);
    if (visitByDay.has(k)) visitByDay.set(k, (visitByDay.get(k) ?? 0) + 1);
  }
  const visitBars: Bucket[] = days.map((d) => ({ day: d, value: visitByDay.get(d) ?? 0 }));

  const topPaths = topCounts(views.map((v) => v.path || "/"), 8);
  const topRefs = topCounts(views.map((v) => v.referrer || "Direct"), 8);
  const topCountries = topCounts(views.map((v) => v.country || "Unknown"), 8);

  return (
    <Shell email={user.email}>
      <Section title="Overview">
        <Grid>
          <StatCard label="Total users" value={totalUsers} sub={`${signups1} new today`} />
          <StatCard label="New sign-ups (7d)" value={signups7} />
          <StatCard label="Active users (7d)" value={active7} />
          <StatCard label="Visits (30d)" value={visits30} sub={`~${avgPerDay}/day`} />
          <StatCard label="Unique visitors (30d)" value={uniques30} />
          <StatCard label="Total houses" value={houses} />
        </Grid>
      </Section>

      <Section title="Traffic — last 30 days">
        <div className="card space-y-2 p-4">
          <BarHeader left={`${visits30} visits`} right={`${uniques30} unique · ${visits7} this week · ${visits1} today`} />
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

      <Section title="Sign-ups — last 30 days">
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
    </Shell>
  );
}

// ---------------------------------------------------------------------------
// Presentational helpers (server-rendered, static markup)
// ---------------------------------------------------------------------------

function Shell({ email, children }: { email?: string | null; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <div className="flex items-center gap-3">
            <HomeLogoLink logoClassName="text-lg" />
            <span className="chip bg-slate-100 text-slate-500">Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {email && <span className="hidden sm:inline">{email}</span>}
            <Link href="/dashboard" className="btn-ghost text-sm">
              App →
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">{children}</main>
    </div>
  );
}

function NoAccess({ email, configured }: { email?: string | null; configured: boolean }) {
  return (
    <Shell email={email}>
      <div className="card mx-auto max-w-lg space-y-3 p-6 text-center">
        <p className="text-3xl">🔒</p>
        <h1 className="text-lg font-bold text-slate-900">Admin access required</h1>
        <p className="text-sm text-slate-600">
          You&rsquo;re signed in as{" "}
          <strong className="break-all text-slate-800">{email ?? "an unknown account"}</strong>,
          which isn&rsquo;t on the admin allowlist.
        </p>
        {configured ? (
          <p className="text-xs text-slate-400">
            Make sure <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> contains
            exactly <code className="break-all rounded bg-slate-100 px-1">{email}</code>, then
            redeploy.
          </p>
        ) : (
          <div className="rounded-xl bg-slate-50 p-3 text-left text-sm text-slate-600">
            <p className="font-medium text-slate-700">To grant yourself access:</p>
            <ol className="ml-4 mt-1 list-decimal space-y-1">
              <li>
                In Vercel, add an environment variable{" "}
                <code className="rounded bg-slate-100 px-1">ADMIN_EMAILS</code> ={" "}
                <code className="break-all rounded bg-slate-100 px-1">{email}</code>
              </li>
              <li>Redeploy, then reload this page.</li>
            </ol>
          </div>
        )}
      </div>
    </Shell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-slate-900">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

function Bars({ data, color }: { data: Bucket[]; color: "brand" | "mint" }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const bar = color === "mint" ? "bg-mint-600" : "bg-brand-500";
  return (
    <div className="flex h-32 items-end gap-1">
      {data.map((d) => (
        <div
          key={d.day}
          title={`${d.day}: ${d.value}`}
          className="flex h-full flex-1 items-end rounded-t bg-slate-100"
        >
          <div
            className={`${bar} w-full rounded-t`}
            style={{ height: `${(d.value / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}

function AxisLabels({ days }: { days: string[] }) {
  const fmt = (d: string) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <div className="flex justify-between text-[10px] text-slate-400">
      <span>{fmt(days[0])}</span>
      <span>{fmt(days[Math.floor(days.length / 2)])}</span>
      <span>{fmt(days[days.length - 1])}</span>
    </div>
  );
}

function BarHeader({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
      <p className="text-sm font-semibold text-slate-700">{left}</p>
      <p className="text-xs text-slate-400">{right}</p>
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="card p-4">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">{title}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">No data yet.</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="relative overflow-hidden rounded">
              <div
                className="absolute inset-y-0 left-0 bg-brand-50"
                style={{ width: `${(r.value / max) * 100}%` }}
              />
              <div className="relative flex items-center justify-between px-1.5 py-1 text-sm">
                <span className="truncate text-slate-600">{r.label}</span>
                <span className="ml-2 shrink-0 font-medium text-slate-500">{r.value}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SignupsTable({
  rows,
  nameById,
}: {
  rows: UserRow[];
  nameById: Map<string, string>;
}) {
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
              <tr key={u.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-700">{u.email ?? "—"}</td>
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
