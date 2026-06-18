import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, msOf } from "@/lib/adminData";
import { AdminShell, Section } from "@/components/admin/AdminUI";
import { ADMIN_BASE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users", robots: { index: false, follow: false } };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const ql = q.toLowerCase();

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="users">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to view users.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const [users, profilesRes, membersRes] = await Promise.all([
    listAllUsers(admin),
    admin.from("profiles").select("id, name"),
    admin.from("house_members").select("user_id"),
  ]);

  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string | null }[]) {
    if (p.name) nameById.set(p.id, p.name);
  }
  const housesByUser = new Map<string, number>();
  for (const m of (membersRes.data ?? []) as { user_id: string }[]) {
    housesByUser.set(m.user_id, (housesByUser.get(m.user_id) ?? 0) + 1);
  }

  let rows = users.map((u) => ({
    ...u,
    name: nameById.get(u.id) ?? "",
    houses: housesByUser.get(u.id) ?? 0,
  }));
  if (ql) {
    rows = rows.filter(
      (u) => (u.email ?? "").toLowerCase().includes(ql) || u.name.toLowerCase().includes(ql),
    );
  }
  rows.sort((a, b) => msOf(b.created_at) - msOf(a.created_at));

  const fmt = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";

  return (
    <AdminShell email={gate.user.email} active="users">
      <Section title={`All users (${users.length})`}>
        <form action={`${ADMIN_BASE}/users`} className="flex gap-2">
          <input
            name="q"
            defaultValue={q}
            placeholder="Search email or name…"
            className="input flex-1"
          />
          <button type="submit" className="btn-secondary">
            Search
          </button>
          {q && (
            <Link href={`${ADMIN_BASE}/users`} className="btn-ghost">
              Clear
            </Link>
          )}
        </form>

        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Last seen</th>
                  <th className="px-4 py-2.5 font-medium">Houses</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-slate-400">
                      {q ? `No users match “${q}”.` : "No users yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((u) => (
                    <tr key={u.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">
                        <Link
                          href={`${ADMIN_BASE}/users/${u.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {u.email ?? "-"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{u.name || "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(u.last_sign_in_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{u.houses}</td>
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
