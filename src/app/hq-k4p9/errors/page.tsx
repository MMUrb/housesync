import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { ResolveAllButton } from "@/components/admin/ErrorActions";
import { ErrorsTable, type ErrorRowView } from "@/components/admin/ErrorsTable";

export const dynamic = "force-dynamic";
export const metadata = { title: "Errors", robots: { index: false, follow: false } };

const DAY = 86_400_000;

type ErrorRow = {
  id: string;
  created_at: string;
  source: string;
  message: string;
  url: string | null;
  user_id: string | null;
  user_agent: string | null;
  stack: string | null;
  digest: string | null;
  resolved_at: string | null;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function ErrorsAdminPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const user = gate.user;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={user.email} active="errors">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to enable error logging.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const since24 = new Date(Date.now() - DAY).toISOString();
  const since7 = new Date(Date.now() - 7 * DAY).toISOString();

  const [recentRes, c24, c7, cUnres] = await Promise.all([
    admin
      .from("error_logs")
      .select("id, created_at, source, message, url, user_id, user_agent, stack, digest, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since24),
    admin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since7),
    admin.from("error_logs").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  const rows = (recentRes.data ?? []) as ErrorRow[];
  const unresolved = cUnres.count ?? 0;

  // Format dates here on the server so the table (a client component) never
  // formats locale-dependent times during hydration.
  const rowViews: ErrorRowView[] = rows.map((r) => ({
    id: r.id,
    whenLabel: fmt(r.created_at),
    source: r.source,
    message: r.message,
    url: r.url,
    user_id: r.user_id,
    user_agent: r.user_agent,
    stack: r.stack,
    digest: r.digest,
    resolved: r.resolved_at != null,
    resolvedLabel: r.resolved_at ? fmt(r.resolved_at) : null,
  }));

  return (
    <AdminShell email={user.email} active="errors">
      <Section title="Errors">
        <Grid>
          <StatCard label="Errors (24h)" value={c24.count ?? 0} />
          <StatCard label="Errors (7d)" value={c7.count ?? 0} />
          <StatCard label="Unresolved" value={unresolved} />
        </Grid>
      </Section>

      <Section
        title="Recent errors"
        action={<ResolveAllButton count={unresolved} />}
      >
        <p className="-mt-1 text-xs text-slate-400">
          Server errors also email the admins (the first of each 15-minute burst). Newest first,
          last 100.
        </p>
        <ErrorsTable rows={rowViews} />
      </Section>
    </AdminShell>
  );
}
