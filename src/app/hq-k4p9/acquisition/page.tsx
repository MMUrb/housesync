import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, countSince, msOf } from "@/lib/adminData";
import { DAY, lastNDays, bucketByDay } from "@/lib/adminMetrics";
import { playConfig, ascConfig } from "@/lib/storeSync";
import { ADMIN_BASE } from "@/lib/constants";
import {
  AdminShell,
  Section,
  Grid,
  StatCard,
  Bars,
  StackedBars,
  AxisLabels,
  BarHeader,
} from "@/components/admin/AdminUI";
import { SyncStoresButton } from "@/components/admin/SyncStoresButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Acquisition", robots: { index: false, follow: false } };

type StoreRow = {
  day: string;
  platform: "ios" | "android";
  downloads: number | null;
  updates: number | null;
  uninstalls: number | null;
  synced_at: string;
};

/** "~0/day" is useless at small volumes; show one decimal until ~10/day. */
const perDay = (total: number) => {
  const avg = total / 30;
  return `~${avg < 10 ? avg.toFixed(1) : Math.round(avg)}/day`;
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  });

export default async function AcquisitionPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="acquisition">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to see acquisition data.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const day30 = since30.slice(0, 10);

  const [users, storeRes, visits30] = await Promise.all([
    listAllUsers(admin),
    // All-time is small (one row per day per platform), so fetch everything.
    admin.from("store_daily").select("*").order("day", { ascending: true }).limit(3000),
    countSince(admin, "page_views", since30),
  ]);

  const store = (storeRes.data ?? []) as StoreRow[];
  const store30 = store.filter((r) => r.day >= day30);

  const sum = (rows: StoreRow[], field: "downloads" | "updates" | "uninstalls") =>
    rows.reduce((s, r) => s + (r[field] ?? 0), 0);
  const ios30 = sum(store30.filter((r) => r.platform === "ios"), "downloads");
  const and30 = sum(store30.filter((r) => r.platform === "android"), "downloads");
  const total30 = ios30 + and30;
  const iosAll = sum(store.filter((r) => r.platform === "ios"), "downloads");
  const andAll = sum(store.filter((r) => r.platform === "android"), "downloads");
  const totalAll = iosAll + andAll;
  const share = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);

  const lastSync = store.length
    ? [...store].sort((a, b) => (a.synced_at < b.synced_at ? 1 : -1))[0].synced_at
    : null;

  // Stacked per-day chart for the last 30 days.
  const days = lastNDays(30);
  const byDay = new Map(days.map((d) => [d, { a: 0, b: 0 }]));
  for (const r of store30) {
    const slot = byDay.get(r.day);
    if (!slot) continue;
    if (r.platform === "ios") slot.a += r.downloads ?? 0;
    else slot.b += r.downloads ?? 0;
  }
  const stacked = days.map((d) => ({ day: d, ...(byDay.get(d) ?? { a: 0, b: 0 }) }));

  const playReady = Boolean(playConfig());
  const ascReady = Boolean(ascConfig());
  const anyData = store.length > 0;

  const d30 = now - 30 * DAY;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const signupBars = bucketByDay(
    users.filter((u) => u.created_at).map((u) => ({ created_at: u.created_at as string })),
    days,
  );

  return (
    <AdminShell email={gate.user.email} active="acquisition">
      <Section title="Downloads" action={<SyncStoresButton />}>
        {anyData ? (
          <>
            <Grid>
              <StatCard label="Downloads (30d)" value={total30} sub={perDay(total30)} />
              <StatCard label="iOS (30d)" value={ios30} sub={`${share(ios30, total30)}% share`} />
              <StatCard label="Android (30d)" value={and30} sub={`${share(and30, total30)}% share`} />
              <StatCard label="All-time total" value={totalAll} sub="since 25/07/2026 launch" />
              <StatCard label="All-time iOS" value={iosAll} sub={`${share(iosAll, totalAll)}% of installs`} />
              <StatCard label="All-time Android" value={andAll} sub={`${share(andAll, totalAll)}% of installs`} />
            </Grid>
            <p className="text-xs text-slate-400">
              Store installs, not sign-ups: a device can install without ever creating an account.
              Store days are bucketed in Pacific time and lag one to two days.
              {lastSync && <> Last sync {fmtDate(lastSync)}.</>}
            </p>
          </>
        ) : (
          <SetupCard playReady={playReady} ascReady={ascReady} />
        )}
      </Section>

      {anyData && (
        <Section title="Downloads per day · last 30 days">
          <div className="card space-y-2 p-4">
            <BarHeader
              left={`${total30.toLocaleString()} downloads`}
              right={`iOS ${ios30.toLocaleString()} · Android ${and30.toLocaleString()}`}
            />
            <StackedBars data={stacked} />
            <AxisLabels days={days} />
            <div className="flex gap-4 text-[11px] font-medium text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-brand-500" /> iOS
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-mint-600" /> Android
              </span>
            </div>
          </div>
        </Section>
      )}

      {anyData && (
        <Section title="Store detail">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-900">App Store</p>
              <p className="text-xs text-slate-400">uk.co.housesync · iOS</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Downloads (30d)" v={ios30.toLocaleString()} />
                <Row k="Updates installed (30d)" v={sum(store30.filter((r) => r.platform === "ios"), "updates").toLocaleString()} />
                <Row k="All-time downloads" v={iosAll.toLocaleString()} />
              </dl>
            </div>
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-900">Google Play</p>
              <p className="text-xs text-slate-400">uk.co.housesync · Android</p>
              <dl className="mt-3 space-y-2 text-sm">
                <Row k="Downloads (30d)" v={and30.toLocaleString()} />
                <Row
                  k="Uninstalls (30d)"
                  v={sum(store30.filter((r) => r.platform === "android"), "uninstalls").toLocaleString()}
                />
                <Row k="All-time downloads" v={andAll.toLocaleString()} />
              </dl>
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Ratings, impressions and store-listing conversion aren&rsquo;t synced yet; they need a
            second pass on each store&rsquo;s reporting API once these numbers are proven right.
          </p>
        </Section>
      )}

      <Section
        title="Sign-ups · last 30 days"
        action={
          <Link
            href={`${ADMIN_BASE}/visitors`}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Full visitor report →
          </Link>
        }
      >
        <div className="card space-y-2 p-4">
          <BarHeader left={`${signups30} new sign-ups`} right={`${users.length} all-time`} />
          <Bars data={signupBars} color="mint" />
          <AxisLabels days={days} />
        </div>
        <Grid>
          <StatCard label="Site visits (30d)" value={visits30} />
          <StatCard label="Sign-ups (30d)" value={signups30} />
          <StatCard
            label="Visit → sign-up"
            value={`${visits30 > 0 ? ((signups30 / visits30) * 100).toFixed(1) : "0.0"}%`}
            sub="aggregate only"
          />
          <StatCard
            label="Installs → sign-up"
            value={total30 > 0 ? `${Math.min(999, Math.round((signups30 / total30) * 100))}%` : "n/a"}
            sub={total30 > 0 ? "rough: includes web sign-ups" : "needs store data"}
          />
        </Grid>
      </Section>
    </AdminShell>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between border-b border-slate-50 pb-2 last:border-0 last:pb-0">
      <dt className="text-slate-500">{k}</dt>
      <dd className="font-semibold text-slate-900">{v}</dd>
    </div>
  );
}

function SetupCard({ playReady, ascReady }: { playReady: boolean; ascReady: boolean }) {
  const Badge = ({ ok }: { ok: boolean }) =>
    ok ? (
      <span className="chip bg-mint-50 text-mint-600">configured</span>
    ) : (
      <span className="chip bg-amber-50 text-amber-700">not configured</span>
    );
  return (
    <div className="card space-y-3 p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        No download data yet. The nightly sync fills this section once the stores are connected.
      </div>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between border-b border-slate-50 pb-2">
          <dt className="text-slate-600">
            App Store <span className="text-xs text-slate-400">(ASC_ISSUER_ID, ASC_KEY_ID, ASC_PRIVATE_KEY, ASC_VENDOR_NUMBER)</span>
          </dt>
          <dd><Badge ok={ascReady} /></dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-slate-600">
            Google Play <span className="text-xs text-slate-400">(PLAY_REPORTS_KEY, PLAY_REPORTS_BUCKET)</span>
          </dt>
          <dd><Badge ok={playReady} /></dd>
        </div>
      </dl>
      <p className="text-xs text-slate-400">
        {playReady || ascReady
          ? "Configured but empty: press Sync now above, or wait for tonight's 06:30 run."
          : "Set the env vars in Vercel, redeploy, then press Sync now."}
      </p>
    </div>
  );
}
