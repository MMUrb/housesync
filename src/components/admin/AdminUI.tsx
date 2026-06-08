import Link from "next/link";
import { HomeLogoLink } from "@/components/HomeLogoLink";
import { isAdminGateEnabled } from "@/lib/adminAuth";
import { AdminLogin, LockButton } from "@/components/admin/AdminLogin";
import { ADMIN_BASE } from "@/lib/constants";

// Shared, server-rendered chrome + presentational pieces for the admin pages.

export type Bucket = { day: string; value: number };

export function AdminShell({
  email,
  active,
  tabs = true,
  unlocked = true,
  children,
}: {
  email?: string | null;
  active: "overview" | "users" | "report";
  tabs?: boolean;
  unlocked?: boolean;
  children: React.ReactNode;
}) {
  const Tab = ({
    href,
    label,
    k,
  }: {
    href: string;
    label: string;
    k: "overview" | "users" | "report";
  }) => (
    <Link
      href={href}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active === k ? "bg-brand-50 text-brand-700" : "text-slate-500 hover:bg-slate-100"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <HomeLogoLink logoClassName="text-lg" />
            <span className="chip bg-slate-100 text-slate-500">Admin</span>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            {email && <span className="hidden truncate sm:inline">{email}</span>}
            {unlocked && isAdminGateEnabled() && <LockButton />}
            <Link href="/dashboard" className="btn-ghost text-sm">
              App →
            </Link>
          </div>
        </div>
        {tabs && (
          <div className="mx-auto flex max-w-6xl gap-1 px-4 pb-2">
            <Tab href={ADMIN_BASE} label="Overview" k="overview" />
            <Tab href={`${ADMIN_BASE}/users`} label="Users" k="users" />
            <Tab href={`${ADMIN_BASE}/report`} label="Churn report" k="report" />
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-8">{children}</main>
    </div>
  );
}

export function AdminLockScreen({ email }: { email?: string | null }) {
  return (
    <AdminShell email={email} active="overview" tabs={false} unlocked={false}>
      <AdminLogin />
    </AdminShell>
  );
}

export function NoAccess({ email, configured }: { email?: string | null; configured: boolean }) {
  return (
    <AdminShell email={email} active="overview" tabs={false}>
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
    </AdminShell>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{children}</div>;
}

export function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: number | string;
  sub?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-2xl font-bold text-slate-900">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="mt-0.5 text-xs font-medium text-slate-500">{label}</p>
      {sub && <p className="mt-0.5 text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}

export function Bars({ data, color }: { data: Bucket[]; color: "brand" | "mint" }) {
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
          <div className={`${bar} w-full rounded-t`} style={{ height: `${(d.value / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

export function AxisLabels({ days }: { days: string[] }) {
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

export function BarHeader({ left, right }: { left: string; right: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2">
      <p className="text-sm font-semibold text-slate-700">{left}</p>
      <p className="text-xs text-slate-400">{right}</p>
    </div>
  );
}

export function RankList({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value: number }[];
}) {
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
