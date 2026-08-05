import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { tableCount } from "@/lib/adminData";
import {
  DAY,
  lastNDays,
  recentActions,
  activeUsers,
  activeHouses,
  dailyActiveSeries,
  housesUsingFeature,
} from "@/lib/adminMetrics";
import {
  AdminShell,
  Section,
  Grid,
  StatCard,
  Bars,
  AxisLabels,
  BarHeader,
} from "@/components/admin/AdminUI";

export const dynamic = "force-dynamic";
export const metadata = { title: "Engagement", robots: { index: false, follow: false } };

const FEATURES: { table: string; label: string }[] = [
  { table: "expenses", label: "Expenses" },
  { table: "messages", label: "Chat" },
  { table: "chores", label: "Chores" },
  { table: "shopping_items", label: "Shopping list" },
  { table: "recurring_bills", label: "Recurring bills" },
  { table: "notices", label: "Noticeboard" },
];

export default async function EngagementPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="engagement">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to see engagement data.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const now = Date.now();
  const since30 = new Date(now - 30 * DAY).toISOString();

  const [actions, totalHouses, ...featureCounts] = await Promise.all([
    recentActions(admin, since30),
    tableCount(admin, "houses"),
    ...FEATURES.map((f) => housesUsingFeature(admin, f.table)),
  ]);

  const d1 = now - DAY;
  const d7 = now - 7 * DAY;
  const d30 = now - 30 * DAY;
  const days = lastNDays(30);

  const dau = activeUsers(actions.rows, d1).size;
  const wau = activeUsers(actions.rows, d7).size;
  const mau = activeUsers(actions.rows, d30).size;
  const stickiness = mau > 0 ? Math.round((dau / mau) * 100) : 0;

  const housesActive7 = activeHouses(actions.rows, d7).size;
  const housesActive30 = activeHouses(actions.rows, d30).size;
  const houseShare = totalHouses > 0 ? Math.round((housesActive30 / totalHouses) * 100) : 0;

  const dauSeries = dailyActiveSeries(actions.rows, days);
  const actionsPerActive = mau > 0 ? (actions.rows.length / mau).toFixed(1) : "0";

  const adoption = FEATURES.map((f, i) => ({
    label: f.label,
    houses: featureCounts[i].houses,
    capped: featureCounts[i].capped,
    pct: totalHouses > 0 ? Math.round((featureCounts[i].houses / totalHouses) * 100) : 0,
  })).sort((a, b) => b.houses - a.houses);

  const anyCapped = adoption.some((a) => a.capped);

  return (
    <AdminShell email={gate.user.email} active="engagement">
      <Section title="Active users · last 30 days">
        <Grid>
          <StatCard label="Daily active" value={dau} sub="did something today" />
          <StatCard label="Weekly active" value={wau} />
          <StatCard label="Monthly active" value={mau} />
          <StatCard label="Stickiness" value={`${stickiness}%`} sub="DAU / MAU" />
          <StatCard label="Actions / active user" value={actionsPerActive} sub="over 30 days" />
          <StatCard
            label="Active houses"
            value={housesActive30}
            sub={`${houseShare}% of ${totalHouses}`}
          />
        </Grid>
        <p className="text-xs text-slate-400">
          &ldquo;Active&rdquo; means they actually did something: added an expense or bill,
          completed a chore, ticked off shopping, posted a notice, settled up or sent a message.
          Signing in alone does not count.
        </p>
        {actions.capped && (
          <p className="text-xs text-amber-600">
            Activity has outgrown the 30-day sample, so these figures cover only the most recent
            slice. Time to move them to a SQL aggregate.
          </p>
        )}
      </Section>

      <Section title="Daily active users">
        <div className="card space-y-2 p-4">
          <BarHeader
            left={`${dau} active today`}
            right={`${wau} this week · ${mau} this month`}
          />
          <Bars data={dauSeries} color="brand" unit="active users" />
          <AxisLabels days={days} />
        </div>
      </Section>

      <Section title="Feature adoption">
        <div className="card space-y-3 p-4">
          <p className="text-xs text-slate-400">
            Share of all {totalHouses.toLocaleString()} houses that have ever used each area.
          </p>
          <ul className="space-y-3">
            {adoption.map((a) => (
              <li key={a.label}>
                <div className="mb-1 flex items-baseline justify-between text-sm">
                  <span className="text-slate-700">{a.label}</span>
                  <span className="font-semibold text-slate-900">
                    {a.pct}%{" "}
                    <span className="font-normal text-slate-400">
                      ({a.houses.toLocaleString()})
                    </span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{ width: `${Math.min(a.pct, 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          {anyCapped && (
            <p className="text-xs text-amber-600">
              At least one feature has more rows than the sample cap, so its share is a floor
              rather than an exact figure.
            </p>
          )}
        </div>
      </Section>

      <Section title="Household health">
        <Grid>
          <StatCard label="Houses" value={totalHouses} />
          <StatCard label="Active (7d)" value={housesActive7} />
          <StatCard label="Active (30d)" value={housesActive30} />
          <StatCard
            label="Quiet (30d)"
            value={Math.max(0, totalHouses - housesActive30)}
            sub="no activity at all"
          />
        </Grid>
      </Section>
    </AdminShell>
  );
}
