import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { ADMIN_BASE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Houses", robots: { index: false, follow: false } };

const DAY = 86_400_000;

type HouseRow = {
  id: string;
  name: string;
  currency: string;
  address_nickname: string | null;
  created_at: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

export default async function HousesPage({
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
      <AdminShell email={gate.user.email} active="houses">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to view houses.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const [housesRes, membersRes] = await Promise.all([
    admin
      .from("houses")
      .select("id, name, currency, address_nickname, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    admin.from("house_members").select("house_id"),
  ]);

  const houses = (housesRes.data ?? []) as HouseRow[];

  const membersByHouse = new Map<string, number>();
  for (const m of (membersRes.data ?? []) as { house_id: string }[]) {
    membersByHouse.set(m.house_id, (membersByHouse.get(m.house_id) ?? 0) + 1);
  }

  const d30 = Date.now() - 30 * DAY;
  const new30 = houses.filter((h) => new Date(h.created_at).getTime() >= d30).length;
  // A house nobody shares is usually someone trying the app solo rather than a
  // real household, so it's worth seeing separately.
  const solo = houses.filter((h) => (membersByHouse.get(h.id) ?? 0) <= 1).length;
  const totalMembers = [...membersByHouse.values()].reduce((s, n) => s + n, 0);
  const avgSize = houses.length ? (totalMembers / houses.length).toFixed(1) : "0";

  const rows = ql
    ? houses.filter(
        (h) =>
          h.name.toLowerCase().includes(ql) ||
          (h.address_nickname ?? "").toLowerCase().includes(ql),
      )
    : houses;

  return (
    <AdminShell email={gate.user.email} active="houses">
      <Section title="Houses">
        <Grid>
          <StatCard label="Total houses" value={houses.length} sub={`${new30} new in 30d`} />
          <StatCard label="Avg. housemates" value={avgSize} />
          <StatCard label="Solo houses" value={solo} sub="1 member or fewer" />
        </Grid>
      </Section>

      <Section title={q ? `Matching “${q}”` : "All houses"}>
        <form action={`${ADMIN_BASE}/houses`} className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search house name…" className="input flex-1" />
          <button type="submit" className="btn-secondary">
            Search
          </button>
          {q && (
            <Link href={`${ADMIN_BASE}/houses`} className="btn-ghost">
              Clear
            </Link>
          )}
        </form>

        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Housemates</th>
                  <th className="px-4 py-2.5 font-medium">Currency</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-slate-400">
                      {q ? `No houses match “${q}”.` : "No houses yet."}
                    </td>
                  </tr>
                ) : (
                  rows.map((h) => (
                    <tr
                      key={h.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`${ADMIN_BASE}/houses/${h.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {h.name}
                        </Link>
                        {h.address_nickname && (
                          <span className="ml-2 text-xs text-slate-400">{h.address_nickname}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {membersByHouse.get(h.id) ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{h.currency}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(h.created_at)}</td>
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
