import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { ResolveAllButton, ResolveOneButton } from "@/components/admin/ErrorActions";

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
      .select("id, created_at, source, message, url, user_id, resolved_at")
      .order("created_at", { ascending: false })
      .limit(100),
    admin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since24),
    admin.from("error_logs").select("id", { count: "exact", head: true }).gte("created_at", since7),
    admin.from("error_logs").select("id", { count: "exact", head: true }).is("resolved_at", null),
  ]);

  const rows = (recentRes.data ?? []) as ErrorRow[];
  const unresolved = cUnres.count ?? 0;

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
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                  <th className="px-4 py-2.5 font-medium">Message</th>
                  <th className="px-4 py-2.5 font-medium">Path</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-slate-400">
                      No errors logged. 🎉
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 ${
                        r.resolved_at ? "opacity-50" : ""
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                        {fmt(r.created_at)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`chip ${
                            r.source === "server"
                              ? "bg-red-50 text-red-600"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {r.source}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-2.5 text-slate-700">
                        <span className="line-clamp-2 break-words">{r.message}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{r.url ?? "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.resolved_at ? (
                          <span className="text-xs text-slate-300">resolved</span>
                        ) : (
                          <ResolveOneButton id={r.id} />
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>
    </AdminShell>
  );
}
