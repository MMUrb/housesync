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
export const metadata = { title: "Visitors", robots: { index: false, follow: false } };

// Rows pulled back for the breakdowns. Headline totals are counted in
// Postgres, so hitting this cap only coarsens charts, never the numbers.
const VIEW_SAMPLE_CAP = 50_000;

type View = {
  path: string;
  referrer: string | null;
  visitor_hash: string | null;
  country: string | null;
  platform: string | null;
  browser: string | null;
  created_at: string;
};

const UK = "Europe/London";

export default async function VisitorsPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="visitors">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to see visitor data.
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
      .select("path, referrer, visitor_hash, country, platform, browser, created_at")
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
  const visitBars = bucketByDay(views, days);

  // The visitor hash rotates daily by design (a privacy feature: nobody can be
  // followed across days). So uniques only ever exist per day: distinct hashes
  // within one UTC day are one person, across days they are not comparable.
  const todayKey = new Date().toISOString().slice(0, 10);
  const uniquesByDay = new Map<string, Set<string>>();
  const viewsPerVisitorDay = new Map<string, number>();
  for (const v of views) {
    if (!v.visitor_hash) continue;
    const day = v.created_at.slice(0, 10);
    let set = uniquesByDay.get(day);
    if (!set) uniquesByDay.set(day, (set = new Set()));
    set.add(v.visitor_hash);
    const key = `${day}|${v.visitor_hash}`;
    viewsPerVisitorDay.set(key, (viewsPerVisitorDay.get(key) ?? 0) + 1);
  }
  const uniquesToday = uniquesByDay.get(todayKey)?.size ?? 0;
  const daysWithTraffic = [...uniquesByDay.values()];
  const avgUniquesPerDay = daysWithTraffic.length
    ? Math.round(daysWithTraffic.reduce((s, set) => s + set.size, 0) / daysWithTraffic.length)
    : 0;

  // Depth: how many pages one person looks at in one day.
  let depth1 = 0;
  let depth2to5 = 0;
  let depth6plus = 0;
  let totalVisitorDays = 0;
  for (const n of viewsPerVisitorDay.values()) {
    totalVisitorDays++;
    if (n === 1) depth1++;
    else if (n <= 5) depth2to5++;
    else depth6plus++;
  }
  const pagesPerVisitorDay = totalVisitorDays
    ? (views.length / totalVisitorDays).toFixed(1)
    : "0";
  const pct = (n: number) => (totalVisitorDays ? Math.round((n / totalVisitorDays) * 100) : 0);

  // When people visit, in UK time.
  const hourFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: UK });
  const weekdayFmt = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: UK });
  const byHour = new Array(24).fill(0) as number[];
  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const byWeekday = new Map(weekdays.map((d) => [d, 0]));
  for (const v of views) {
    const date = new Date(v.created_at);
    const h = Number.parseInt(hourFmt.format(date), 10) % 24;
    byHour[h]++;
    const wd = weekdayFmt.format(date);
    if (byWeekday.has(wd)) byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1);
  }
  const hourBars = byHour.map((value, h) => ({
    day: `${String(h).padStart(2, "0")}:00`,
    value,
  }));
  const weekTotal = Math.max(1, views.length);
  const peakHour = byHour.indexOf(Math.max(...byHour));
  const peakDay = [...byWeekday.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  // Platform/browser from the new coarse columns; empty until 0036 + deploy
  // have been live for a while.
  const withPlatform = views.filter((v) => v.platform);
  const topPlatforms = topCounts(withPlatform.map((v) => v.platform as string), 6);
  const topBrowsers = topCounts(
    views.filter((v) => v.browser).map((v) => v.browser as string),
    6,
  );

  const topPaths = topCounts(views.map((v) => v.path || "/"), 8);
  const topRefs = topCounts(views.map((v) => v.referrer || "Direct"), 8);
  const topCountries = topCounts(views.map((v) => v.country || "Unknown"), 8);

  const d30 = now - 30 * DAY;
  const signups30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const conversion = visits30 > 0 ? ((signups30 / visits30) * 100).toFixed(1) : "0.0";

  return (
    <AdminShell email={gate.user.email} active="visitors">
      <Section title="Site visitors · last 30 days">
        <Grid>
          <StatCard label="Visits (1d)" value={visits1} />
          <StatCard label="Visits (7d)" value={visits7} sub={`~${Math.round(visits7 / 7)}/day`} />
          <StatCard
            label="Visits (30d)"
            value={visits30}
            sub={`~${Math.round(visits30 / 30)}/day`}
          />
          <StatCard label="Unique visitors today" value={uniquesToday} />
          <StatCard label="Avg. unique / day" value={avgUniquesPerDay} sub="30 days" />
          <StatCard label="Visit → sign-up" value={`${conversion}%`} sub={`${signups30} sign-ups`} />
        </Grid>
        <p className="text-xs text-slate-400">
          Visitor identities rotate daily on purpose (nobody can be followed across days), so
          uniques are per-day: the same person on Monday and Tuesday counts once each day.
        </p>
      </Section>

      <Section title="Visits per day">
        <div className="card space-y-2 p-4">
          <BarHeader
            left={`${visits30.toLocaleString()} visits`}
            right={`${visits7.toLocaleString()} this week · ${visits1.toLocaleString()} in the last day`}
          />
          <Bars data={visitBars} color="brand" />
          <AxisLabels days={days} />
        </div>
        {sampleCapped && (
          <p className="text-xs text-amber-600">
            Over {VIEW_SAMPLE_CAP.toLocaleString()} views in 30 days: totals are exact, but the
            charts and breakdowns below cover only the most recent{" "}
            {VIEW_SAMPLE_CAP.toLocaleString()}.
          </p>
        )}
      </Section>

      <Section title="How deep people go">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pages viewed per visitor-day
            </p>
            <ul className="space-y-3">
              {[
                ["1 page", depth1],
                ["2–5 pages", depth2to5],
                ["6+ pages", depth6plus],
              ].map(([label, n]) => (
                <li key={label as string}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">{label}</span>
                    <span className="font-semibold text-slate-900">
                      {pct(n as number)}%{" "}
                      <span className="font-normal text-slate-400">
                        ({(n as number).toLocaleString()})
                      </span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct(n as number)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Averages
            </p>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <dt className="text-slate-500">Pages per visitor-day</dt>
                <dd className="font-semibold text-slate-900">{pagesPerVisitorDay}</dd>
              </div>
              <div className="flex justify-between border-b border-slate-50 pb-2">
                <dt className="text-slate-500">Visitor-days in sample</dt>
                <dd className="font-semibold text-slate-900">
                  {totalVisitorDays.toLocaleString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">All-time page views</dt>
                <dd className="font-semibold text-slate-900">{totalViews.toLocaleString()}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Section>

      <Section title="When people visit">
        <div className="card space-y-2 p-4">
          <BarHeader
            left="By hour of day"
            right={`UK time · peak ${String(peakHour).padStart(2, "0")}:00 on ${peakDay}s`}
          />
          <Bars data={hourBars} color="brand" />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>23:00</span>
          </div>
        </div>
        <div className="card p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
            By day of week
          </p>
          <ul className="space-y-3">
            {weekdays.map((wd) => {
              const n = byWeekday.get(wd) ?? 0;
              const share = Math.round((n / weekTotal) * 100);
              const maxShare = Math.max(
                1,
                ...weekdays.map((w) => byWeekday.get(w) ?? 0),
              );
              return (
                <li key={wd}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">{wd}</span>
                    <span className="font-semibold text-slate-900">
                      {share}%{" "}
                      <span className="font-normal text-slate-400">({n.toLocaleString()})</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${Math.round((n / maxShare) * 100)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </Section>

      <Section title="Devices & browsers">
        {withPlatform.length === 0 ? (
          <div className="card p-4 text-sm text-slate-500">
            Collecting from the next deploy onwards: page views now record a coarse platform and
            browser label (never the raw user agent). This section fills in as new visits arrive.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <RankList title="Platforms" rows={topPlatforms} />
            <RankList title="Browsers" rows={topBrowsers} />
          </div>
        )}
      </Section>

      <Section title="Where they go & where they come from">
        <div className="grid gap-4 sm:grid-cols-3">
          <RankList title="Top pages" rows={topPaths} />
          <RankList title="Top sources" rows={topRefs} />
          <RankList title="Countries" rows={topCountries} />
        </div>
      </Section>
    </AdminShell>
  );
}
