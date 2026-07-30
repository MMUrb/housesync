import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, tableCount, countSince, msOf } from "@/lib/adminData";
import { DAY, lastNDays, bucketByDay, topCounts } from "@/lib/adminMetrics";
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

export const dynamic = "force-dynamic";
export const metadata = { title: "Acquisition", robots: { index: false, follow: false } };

// Rows pulled back to build the breakdowns. Totals are counted in Postgres, so
// hitting this only coarsens the charts, it never makes the headline wrong.
const VIEW_SAMPLE_CAP = 50_000;

type View = {
  path: string;
  referrer: string | null;
  visitor_hash: string | null;
  country: string | null;
  created_at: string;
};

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
  const since1 = new Date(now - DAY).toISOString();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [users, viewsRes, totalViews, visits1, visits7, visits30] = await Promise.all([
    listAllUsers(admin),
    admin
      .from("page_views")
      .select("path, referrer, visitor_hash, country, created_at")
      .gte("created_at", since30)
      .order("created_at", { ascending: false })
      .limit(VIEW_SAMPLE_CAP),
    tableCount(admin, "page_views"),
    countSince(admin, "page_views", since1),
    countSince(admin, "page_views", since7),
    countSince(admin, "page_views", since30),
  ]);

  const views = (viewsRes.data ?? []) as View[];
  const sampleCapped = views.length >= VIEW_SAMPLE_CAP;
  const days = lastNDays(30);

  const uniques30 = new Set(views.map((v) => v.visitor_hash ?? "")).size;
  const visitBars = bucketByDay(views, days);

  const d30 = now - 30 * DAY;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const signupBars = bucketByDay(
    users.filter((u) => u.created_at).map((u) => ({ created_at: u.created_at as string })),
    days,
  );
  // Visit-to-sign-up is aggregate only: page_views has no user_id, so a visit
  // can never be tied to the account it eventually produced.
  const conversion = visits30 > 0 ? ((signups30 / visits30) * 100).toFixed(1) : "0.0";

  const topPaths = topCounts(views.map((v) => v.path || "/"), 8);
  const topRefs = topCounts(views.map((v) => v.referrer || "Direct"), 8);
  const topCountries = topCounts(views.map((v) => v.country || "Unknown"), 8);

  return (
    <AdminShell email={gate.user.email} active="acquisition">
      <Section title="Web acquisition · last 30 days">
        <Grid>
          <StatCard label="Visits (1d)" value={visits1} />
          <StatCard label="Visits (7d)" value={visits7} sub={`~${Math.round(visits7 / 7)}/day`} />
          <StatCard
            label="Visits (30d)"
            value={visits30}
            sub={`~${Math.round(visits30 / 30)}/day`}
          />
          <StatCard
            label="Unique visitors"
            value={uniques30}
            sub={sampleCapped ? "sampled" : "30d"}
          />
          <StatCard label="Sign-ups (30d)" value={signups30} />
          <StatCard label="Visit → sign-up" value={`${conversion}%`} sub="aggregate only" />
        </Grid>
      </Section>

      <Section title="Traffic">
        <div className="card space-y-2 p-4">
          <BarHeader
            left={`${visits30.toLocaleString()} visits`}
            right={`${uniques30.toLocaleString()} unique · ${visits7.toLocaleString()} this week`}
          />
          <Bars data={visitBars} color="brand" />
          <AxisLabels days={days} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <RankList title="Top pages" rows={topPaths} />
          <RankList title="Top sources" rows={topRefs} />
          <RankList title="Countries" rows={topCountries} />
        </div>
        {sampleCapped && (
          <p className="text-xs text-amber-600">
            Over {VIEW_SAMPLE_CAP.toLocaleString()} views in 30 days. Totals above are exact, but
            the chart, unique count and top-lists cover only the most recent{" "}
            {VIEW_SAMPLE_CAP.toLocaleString()}.
          </p>
        )}
        <p className="text-xs text-slate-400">
          All-time page views: {totalViews.toLocaleString()}
        </p>
      </Section>

      <Section title="Sign-ups">
        <div className="card space-y-2 p-4">
          <BarHeader left={`${signups30} new sign-ups`} right={`${users.length} all-time`} />
          <Bars data={signupBars} color="mint" />
          <AxisLabels days={days} />
        </div>
      </Section>

      <Section title="App stores">
        <div className="card space-y-3 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="chip bg-amber-50 text-amber-700">Not connected</span>
            <span className="text-sm text-slate-600">
              Downloads, installs, uninstalls, ratings and store conversion are not in this
              dashboard yet.
            </span>
          </div>
          <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-white/[0.04]">
            <p className="font-medium text-slate-700">What connecting them needs:</p>
            <ul className="ml-4 mt-2 list-disc space-y-1.5">
              <li>
                <strong>App Store Connect API</strong> for downloads, redownloads, updates,
                impressions, product page views and territories. Uses an issuer ID plus a{" "}
                <code className="rounded bg-slate-100 px-1 dark:bg-white/10">.p8</code> key.
              </li>
              <li>
                <strong>Google Play</strong> does not expose install counts through the Developer
                API at all. They arrive as CSV reports in a Cloud Storage bucket, read with a
                service account. Crash and ANR rates come from the separate Play Developer
                Reporting API.
              </li>
              <li>
                Neither is fast enough to query while a page loads, so both would sync nightly
                into a table here and this page would read that.
              </li>
            </ul>
          </div>
          <p className="text-xs text-slate-400">
            Deliberately left empty rather than filled with estimates: a made-up download number
            is worse than none.
          </p>
        </div>
      </Section>
    </AdminShell>
  );
}
