import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { deletionReasonLabel } from "@/lib/deletion";

export const dynamic = "force-dynamic";
export const metadata = { title: "Churn report", robots: { index: false, follow: false } };

type Feedback = { reason: string | null; comment: string | null; created_at: string };

const DAY = 86_400_000;

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
    .select("reason, comment, created_at")
    .order("created_at", { ascending: false })
    .limit(5000);
  const rows = (data ?? []) as Feedback[];

  const total = rows.length;
  const now = Date.now();
  const last30 = rows.filter((r) => new Date(r.created_at).getTime() >= now - 30 * DAY).length;

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
        </Grid>
        <p className="text-xs text-slate-400">
          Feedback is anonymous — no email or identity is stored when someone deletes their account.
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
            comments.map((c, i) => (
              <div key={i} className="space-y-1.5 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="chip bg-slate-100 text-slate-500">
                    {deletionReasonLabel(c.reason)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(c.created_at).toLocaleString("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{c.comment}</p>
              </div>
            ))
          )}
        </div>
      </Section>
    </AdminShell>
  );
}
