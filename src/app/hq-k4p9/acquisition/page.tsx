import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, countSince, msOf } from "@/lib/adminData";
import { DAY, lastNDays } from "@/lib/adminMetrics";
import { playConfig, ascConfig } from "@/lib/storeSync";
import { channelOf } from "@/lib/signupChannel";
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
import { ReviewColumn, type ReviewView } from "@/components/admin/StoreReviews";

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

type ReviewRow = {
  id: string;
  platform: "ios" | "android";
  rating: number;
  title: string | null;
  body: string | null;
  author: string | null;
  territory: string | null;
  app_version: string | null;
  reviewed_at: string;
};

/** "3 days ago" style recency for review meta lines. */
function agoLabel(iso: string): string {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (d < 1) return "today";
  if (d === 1) return "yesterday";
  if (d < 30) return `${d} days ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} month${mo === 1 ? "" : "s"} ago` : `${Math.round(mo / 12)} years ago`;
}

function toReviewView(r: ReviewRow): ReviewView {
  const meta = [r.author ?? (r.platform === "android" ? "Play user" : null), r.territory, r.app_version ? `v${r.app_version}` : null, agoLabel(r.reviewed_at)]
    .filter(Boolean)
    .join(" · ");
  return { id: r.id, rating: r.rating, title: r.title, body: r.body, metaLabel: meta };
}

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

  const [users, storeRes, reviewsRes, visits30, pushRes, membersRes, housesRes, profilesRes] =
    await Promise.all([
      listAllUsers(admin),
      // All-time is small (one row per day per platform), so fetch everything.
      admin.from("store_daily").select("*").order("day", { ascending: true }).limit(3000),
      admin
        .from("store_reviews")
        .select("*")
        .order("reviewed_at", { ascending: false })
        .limit(1000),
      countSince(admin, "page_views", since30),
      admin.from("push_subscriptions").select("user_id, platform"),
      admin.from("house_members").select("user_id, house_id"),
      admin.from("houses").select("id, name").limit(2000),
      admin.from("profiles").select("id, name"),
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

  const reviews = (reviewsRes.data ?? []) as ReviewRow[];
  const iosReviews = reviews.filter((r) => r.platform === "ios");
  const andReviews = reviews.filter((r) => r.platform === "android");
  const avg = (rows: ReviewRow[]) =>
    rows.length ? (rows.reduce((s, r) => s + r.rating, 0) / rows.length).toFixed(1) : null;
  const iosAvg = avg(iosReviews);
  const andAvg = avg(andReviews);

  const d30 = now - 30 * DAY;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;

  // Sign-ups by channel: exact stamps where they exist (SignupPlatformStamp),
  // honest estimates otherwise. See lib/signupChannel for the rules.
  const pushByUser = new Map<string, Set<string>>();
  for (const p of (pushRes.data ?? []) as { user_id: string; platform: string | null }[]) {
    if (!p.platform) continue;
    let set = pushByUser.get(p.user_id);
    if (!set) pushByUser.set(p.user_id, (set = new Set()));
    set.add(p.platform);
  }
  const houseNameById = new Map(
    ((housesRes.data ?? []) as { id: string; name: string }[]).map((h) => [h.id, h.name]),
  );
  const firstHouseOfUser = new Map<string, string>();
  for (const m of (membersRes.data ?? []) as { user_id: string; house_id: string }[]) {
    if (!firstHouseOfUser.has(m.user_id)) firstHouseOfUser.set(m.user_id, m.house_id);
  }
  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string | null }[]) {
    if (p.name) nameById.set(p.id, p.name);
  }

  const channelled = users.map((u) => ({ ...u, ...channelOf(u, pushByUser.get(u.id)) }));
  const recent30 = channelled.filter((u) => msOf(u.created_at) >= d30);
  const web30 = recent30.filter((u) => u.channel === "web").length;
  const iosSign30 = recent30.filter((u) => u.channel === "ios-app").length;
  const andSign30 = recent30.filter((u) => u.channel === "android-app").length;
  const chShare = (n: number) => (signups30 > 0 ? Math.round((n / signups30) * 100) : 0);
  const webAll = channelled.filter((u) => u.channel === "web");
  const webJoined = webAll.filter((u) => firstHouseOfUser.has(u.id)).length;
  const estimatedCount = channelled.filter((u) => !u.exact).length;

  const signupByDay = new Map(days.map((day) => [day, { a: 0, b: 0 }]));
  for (const u of recent30) {
    if (!u.created_at) continue;
    const slot = signupByDay.get(u.created_at.slice(0, 10));
    if (!slot) continue;
    if (u.channel === "web") slot.b += 1;
    else slot.a += 1;
  }
  const signupStacked = days.map((day) => ({ day, ...(signupByDay.get(day) ?? { a: 0, b: 0 }) }));

  const latestWeb = webAll
    .filter((u) => u.created_at)
    .sort((a, b) => msOf(b.created_at) - msOf(a.created_at))
    .slice(0, 8);

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

      <Section title="Reviews">
        {reviews.length > 0 && (
          <Grid>
            <StatCard
              label="App Store average"
              value={iosAvg ? `${iosAvg} ★` : "–"}
              sub={iosAvg ? "from written reviews" : "no reviews yet"}
            />
            <StatCard
              label="App Store written"
              value={iosReviews.length}
              sub={iosReviews.length ? `latest ${agoLabel(iosReviews[0].reviewed_at)}` : undefined}
            />
            <StatCard
              label="Google Play average"
              value={andAvg ? `${andAvg} ★` : "–"}
              sub={andAvg ? "from written reviews" : "no reviews yet"}
            />
            <StatCard
              label="Google Play written"
              value={andReviews.length}
              sub={andReviews.length ? `latest ${agoLabel(andReviews[0].reviewed_at)}` : undefined}
            />
          </Grid>
        )}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <ReviewColumn
            store="App Store"
            tone="ios"
            reviews={iosReviews.map(toReviewView)}
            emptyText="No written App Store reviews yet. They appear here as soon as someone leaves one."
          />
          <ReviewColumn
            store="Google Play"
            tone="android"
            reviews={andReviews.map(toReviewView)}
            emptyText="No written Play reviews yet. Google generates the report once the first one lands."
          />
        </div>
        <p className="text-xs text-slate-400">
          Written reviews only: star-only ratings have no text to show and are not included in
          these averages. Replying still happens in App Store Connect and Play Console.
        </p>
      </Section>

      <Section
        title="Sign-ups by channel"
        action={
          <Link
            href={`${ADMIN_BASE}/visitors`}
            className="text-xs font-medium text-brand-600 hover:underline"
          >
            Full visitor report →
          </Link>
        }
      >
        <Grid>
          <StatCard label="Web sign-ups (30d)" value={web30} sub={`${chShare(web30)}% of ${signups30}`} />
          <StatCard label="iOS app (30d)" value={iosSign30} sub={`${chShare(iosSign30)}%`} />
          <StatCard label="Android app (30d)" value={andSign30} sub={`${chShare(andSign30)}%`} />
          <StatCard
            label="All-time web"
            value={webAll.length}
            sub={`${users.length ? Math.round((webAll.length / users.length) * 100) : 0}% of accounts`}
          />
          <StatCard
            label="Web → house joined"
            value={webAll.length ? `${Math.round((webJoined / webAll.length) * 100)}%` : "n/a"}
            sub={`${webJoined} of ${webAll.length} activate`}
          />
        </Grid>

        <div className="card space-y-2 p-4">
          <BarHeader
            left={`${signups30} sign-ups`}
            right={`apps ${iosSign30 + andSign30} · web ${web30}`}
          />
          <StackedBars
            data={signupStacked}
            aLabel="Apps"
            bLabel="Web"
            unit="sign-ups"
            unitSingular="sign-up"
          />
          <AxisLabels days={days} />
          <div className="flex gap-4 text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-brand-500" /> In the apps
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-sm bg-mint-600" /> On the website
            </span>
          </div>
        </div>

        <div className="card p-0">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 p-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Latest website sign-ups</p>
              <p className="text-xs text-slate-400">Exact date and time each one registered</p>
            </div>
            <span className="text-xs text-slate-400">{webAll.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Signed up</th>
                  <th className="px-4 py-2.5 font-medium">Joined a house</th>
                </tr>
              </thead>
              <tbody>
                {latestWeb.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-slate-400">
                      No website sign-ups yet.
                    </td>
                  </tr>
                ) : (
                  latestWeb.map((u) => {
                    const houseId = firstHouseOfUser.get(u.id);
                    return (
                      <tr
                        key={u.id}
                        className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-2.5">
                          <Link
                            href={`${ADMIN_BASE}/directory/u/${u.id}`}
                            className="font-medium text-brand-700 hover:underline"
                          >
                            {nameById.get(u.id) ?? u.email ?? "Unnamed"}
                          </Link>
                          {!u.exact && (
                            <span
                              className="ml-2 text-[10px] uppercase tracking-wide text-slate-300"
                              title="Channel estimated, not stamped at registration"
                            >
                              est.
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">{u.email ?? "-"}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-700">
                          {u.created_at ? fmtDate(u.created_at) : "-"}
                        </td>
                        <td className="px-4 py-2.5">
                          {houseId ? (
                            <span className="chip bg-mint-50 text-mint-600">
                              Yes · {houseNameById.get(houseId) ?? "house"}
                            </span>
                          ) : (
                            <span className="chip bg-red-50 text-red-600">Not yet</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Sign-ups from this deploy onwards are stamped exactly at registration. Older accounts are
          estimated (Apple sign-in means the iOS app, a push token names its platform, the rest
          lean web) and carry an &ldquo;est.&rdquo; mark: {estimatedCount} of {users.length}{" "}
          accounts are estimates right now. Visit → sign-up{" "}
          {visits30 > 0 ? ((signups30 / visits30) * 100).toFixed(1) : "0.0"}%
          {total30 > 0 && (
            <> · installs → sign-up roughly {Math.min(999, Math.round((signups30 / total30) * 100))}%</>
          )}
          .
        </p>
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
