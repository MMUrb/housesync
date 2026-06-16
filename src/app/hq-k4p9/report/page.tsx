import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { deletionReasonLabel } from "@/lib/deletion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Churn report", robots: { index: false, follow: false } };

type Feedback = {
  reason: string | null;
  comment: string | null;
  created_at: string;
  days_active: number | null;
  platform: string | null;
  houses_joined: number | null;
  messages_sent: number | null;
  expenses_added: number | null;
};

const DAY = 86_400_000;

/** "3 days ago", "2 months ago" — quick recency scan. */
function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} month${mo === 1 ? "" : "s"} ago`;
  const y = Math.round(mo / 12);
  return `${y} year${y === 1 ? "" : "s"} ago`;
}

/** How long they were a member, in friendly units. Null if not recorded. */
function memberFor(days: number | null): string | null {
  if (days == null) return null;
  if (days < 1) return "less than a day";
  if (days < 14) return `${days} day${days === 1 ? "" : "s"}`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  if (days < 365) return `${Math.round(days / 30)} months`;
  return `${Math.round((days / 365) * 10) / 10} years`;
}

const platformLabel = (p: string | null) => (p === "app" ? "App" : p === "web" ? "Web" : null);

export default async function ReportPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const user = gate.user;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={user.email} active="report">
        <p className="card p-4 text-sm text-slate-600">
          Analytics isn&rsquo;t configured yet: set <code>SUPABASE_SERVICE_ROLE_KEY</code> and reload.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("deletion_feedback")
    .select(
      "reason, comment, created_at, days_active, platform, houses_joined, messages_sent, expenses_added",
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as Feedback[];

  const total = rows.length;
  const now = Date.now();
  const last30 = rows.filter((r) => new Date(r.created_at).getTime() >= now - 30 * DAY).length;

  const withDays = rows.filter((r) => typeof r.days_active === "number");
  const avgDays = withDays.length
    ? Math.round(withDays.reduce((s, r) => s + (r.days_active ?? 0), 0) / withDays.length)
    : null;

  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = r.reason ?? "unspecified";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const breakdown = [...counts.entries()]
    .map(([code, count]) => ({ code, label: deletionReasonLabel(code), count }))
    .sort((a, b) => b.count - a.count);

  const pct = (n: number) => (total ? Math.round((n / total) * 100) : 0);
  const comments = rows.filter((r) => r.comment && r.comment.trim());

  return (
    <AdminShell email={user.email} active="report">
      <Section title="Account deletions">
        <Grid>
          <StatCard label="Total deletions" value={total} />
          <StatCard label="Last 30 days" value={last30} />
          <StatCard label="With a comment" value={comments.length} />
          {avgDays != null && (
            <StatCard label="Avg. time before leaving" value={avgDays} sub="days as a member" />
          )}
        </Grid>
        <p className="text-xs text-slate-400">
          Feedback is anonymous. No email or identity is stored when someone deletes their account.
          Only deletions from when this feature went live are counted.
        </p>
      </Section>

      <Section title="Why people leave">
        <div className="card p-4">
          {total === 0 ? (
            <p className="text-sm text-slate-400">
              No account deletions recorded yet. Reasons will appear here as people leave.
            </p>
          ) : (
            <ul className="space-y-3">
              {breakdown.map((b) => (
                <li key={b.code}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-700">{b.label}</span>
                    <span className="font-semibold text-slate-900">
                      {pct(b.count)}% <span className="font-normal text-slate-400">({b.count})</span>
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-brand-500"
                      style={{ width: `${pct(b.count)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Section>

      <Section title="Comments">
        <div className="card divide-y divide-slate-100 p-0">
          {comments.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">No written comments yet.</p>
          ) : (
            comments.map((c, i) => {
              const abs = new Date(c.created_at).toLocaleString("en-GB", {
                dateStyle: "medium",
                timeStyle: "short",
              });
              const meta: string[] = [];
              const dur = memberFor(c.days_active);
              if (dur) meta.push(`Member for ${dur}`);
              if (c.houses_joined != null)
                meta.push(`${c.houses_joined} house${c.houses_joined === 1 ? "" : "s"}`);
              if (c.messages_sent != null)
                meta.push(`${c.messages_sent} message${c.messages_sent === 1 ? "" : "s"}`);
              if (c.expenses_added != null)
                meta.push(`${c.expenses_added} expense${c.expenses_added === 1 ? "" : "s"}`);
              const plat = platformLabel(c.platform);
              if (plat) meta.push(`via ${plat}`);
              return (
                <div key={i} className="space-y-1.5 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-300">#{comments.length - i}</span>
                    <span className="chip bg-slate-100 text-slate-500">
                      {deletionReasonLabel(c.reason)}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400" title={abs}>
                      {relTime(c.created_at)}
                    </span>
                  </div>
                  {meta.length > 0 && <p className="text-xs text-slate-500">{meta.join(" · ")}</p>}
                  <p className="whitespace-pre-wrap break-words text-sm text-slate-700">
                    {c.comment}
                  </p>
                </div>
              );
            })
          )}
        </div>
      </Section>
    </AdminShell>
  );
}
