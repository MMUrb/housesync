import "server-only";
import Link from "next/link";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { listAllUsers, msOf, type AdminUserRow } from "@/lib/adminData";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { ADMIN_BASE } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Directory", robots: { index: false, follow: false } };

// Rendered rows per page. The auth API has no server-side search, so the full
// list is still fetched to filter against; this only bounds the HTML we send.
const PER_PAGE = 100;
const DAY = 86_400_000;

type View = "people" | "houses";

type HouseRow = {
  id: string;
  name: string;
  currency: string;
  address_nickname: string | null;
  created_at: string;
};

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; page?: string }>;
}) {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  const sp = await searchParams;
  const view: View = sp.view === "houses" ? "houses" : "people";
  const q = (typeof sp.q === "string" ? sp.q : "").trim();
  const ql = q.toLowerCase();
  const pageParam = Number.parseInt(sp.page ?? "1", 10);

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="directory">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to browse the directory.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const [users, profilesRes, membersRes, housesRes] = await Promise.all([
    listAllUsers(admin),
    admin.from("profiles").select("id, name"),
    admin.from("house_members").select("user_id, house_id, role"),
    admin
      .from("houses")
      .select("id, name, currency, address_nickname, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const nameById = new Map<string, string>();
  for (const p of (profilesRes.data ?? []) as { id: string; name: string | null }[]) {
    if (p.name) nameById.set(p.id, p.name);
  }

  const houses = (housesRes.data ?? []) as HouseRow[];
  const houseNameById = new Map(houses.map((h) => [h.id, h.name]));

  const members = (membersRes.data ?? []) as {
    user_id: string;
    house_id: string;
    role: string;
  }[];

  const housesOfUser = new Map<string, string[]>();
  const membersOfHouse = new Map<string, number>();
  for (const m of members) {
    const list = housesOfUser.get(m.user_id) ?? [];
    list.push(m.house_id);
    housesOfUser.set(m.user_id, list);
    membersOfHouse.set(m.house_id, (membersOfHouse.get(m.house_id) ?? 0) + 1);
  }

  // Headline counts, shown on both views so the two never look disconnected.
  const d30 = Date.now() - 30 * DAY;
  const d7 = Date.now() - 7 * DAY;
  const totalUsers = users.length;
  const new30 = users.filter((u) => msOf(u.created_at) >= d30).length;
  const seen7 = users.filter((u) => msOf(u.last_sign_in_at) >= d7).length;
  const inAHouse = [...housesOfUser.keys()].length;
  const noHouse = totalUsers - inAHouse;
  const solo = houses.filter((h) => (membersOfHouse.get(h.id) ?? 0) <= 1).length;
  const avgSize = houses.length
    ? (members.length / houses.length).toFixed(1)
    : "0";

  const tabHref = (v: View) => `${ADMIN_BASE}/directory${v === "houses" ? "?view=houses" : ""}`;
  const pageHref = (p: number) =>
    `${ADMIN_BASE}/directory?${new URLSearchParams({
      ...(view === "houses" ? { view: "houses" } : {}),
      ...(q ? { q } : {}),
      page: String(p),
    })}`;

  return (
    <AdminShell email={gate.user.email} active="directory">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-sm font-semibold dark:bg-white/[0.06]">
        <Link
          href={tabHref("people")}
          className={`flex-1 rounded-md px-3 py-1.5 text-center transition ${
            view === "people"
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
              : "text-slate-500"
          }`}
        >
          People ({totalUsers.toLocaleString()})
        </Link>
        <Link
          href={tabHref("houses")}
          className={`flex-1 rounded-md px-3 py-1.5 text-center transition ${
            view === "houses"
              ? "bg-white text-slate-900 shadow-sm dark:bg-white/[0.12]"
              : "text-slate-500"
          }`}
        >
          Households ({houses.length.toLocaleString()})
        </Link>
      </div>

      {view === "people" ? (
        <PeopleView
          users={users}
          nameById={nameById}
          housesOfUser={housesOfUser}
          houseNameById={houseNameById}
          q={q}
          ql={ql}
          pageParam={pageParam}
          pageHref={pageHref}
          stats={{ totalUsers, new30, seen7, inAHouse, noHouse }}
        />
      ) : (
        <HousesView
          houses={houses}
          membersOfHouse={membersOfHouse}
          q={q}
          ql={ql}
          pageParam={pageParam}
          pageHref={pageHref}
          stats={{ total: houses.length, avgSize, solo, members: members.length }}
        />
      )}
    </AdminShell>
  );
}

/* -------------------------------------------------------------------------- */

function SearchForm({ view, q }: { view: View; q: string }) {
  return (
    <form action={`${ADMIN_BASE}/directory`} className="flex gap-2">
      {view === "houses" && <input type="hidden" name="view" value="houses" />}
      <input
        name="q"
        defaultValue={q}
        placeholder={view === "houses" ? "Search house name…" : "Search email, name or house…"}
        className="input flex-1"
      />
      <button type="submit" className="btn-secondary">
        Search
      </button>
      {q && (
        <Link
          href={`${ADMIN_BASE}/directory${view === "houses" ? "?view=houses" : ""}`}
          className="btn-ghost"
        >
          Clear
        </Link>
      )}
    </form>
  );
}

function Pager({
  page,
  pageCount,
  start,
  perPage,
  matched,
  pageHref,
}: {
  page: number;
  pageCount: number;
  start: number;
  perPage: number;
  matched: number;
  pageHref: (p: number) => string;
}) {
  if (pageCount <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-slate-400">
        Showing {start + 1}-{Math.min(start + perPage, matched)} of {matched}
      </p>
      <div className="flex items-center gap-2">
        {page > 1 ? (
          <Link href={pageHref(page - 1)} className="btn-secondary text-sm">
            ← Previous
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none text-sm opacity-40">← Previous</span>
        )}
        <span className="text-xs text-slate-400">
          Page {page} of {pageCount}
        </span>
        {page < pageCount ? (
          <Link href={pageHref(page + 1)} className="btn-secondary text-sm">
            Next →
          </Link>
        ) : (
          <span className="btn-secondary pointer-events-none text-sm opacity-40">Next →</span>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function PeopleView({
  users,
  nameById,
  housesOfUser,
  houseNameById,
  q,
  ql,
  pageParam,
  pageHref,
  stats,
}: {
  users: AdminUserRow[];
  nameById: Map<string, string>;
  housesOfUser: Map<string, string[]>;
  houseNameById: Map<string, string>;
  q: string;
  ql: string;
  pageParam: number;
  pageHref: (p: number) => string;
  stats: { totalUsers: number; new30: number; seen7: number; inAHouse: number; noHouse: number };
}) {
  let rows = users.map((u) => {
    const ids = housesOfUser.get(u.id) ?? [];
    return {
      ...u,
      name: nameById.get(u.id) ?? "",
      houseIds: ids,
      houseLabel: ids.length
        ? [houseNameById.get(ids[0]) ?? "Unknown house", ids.length > 1 ? `+${ids.length - 1}` : ""]
            .filter(Boolean)
            .join(" ")
        : "",
    };
  });

  if (ql) {
    rows = rows.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(ql) ||
        u.name.toLowerCase().includes(ql) ||
        u.houseLabel.toLowerCase().includes(ql),
    );
  }
  rows.sort((a, b) => msOf(b.created_at) - msOf(a.created_at));

  const matched = rows.length;
  const pageCount = Math.max(1, Math.ceil(matched / PER_PAGE));
  const page = Math.min(Math.max(Number.isFinite(pageParam) ? pageParam : 1, 1), pageCount);
  const start = (page - 1) * PER_PAGE;
  const visible = rows.slice(start, start + PER_PAGE);

  return (
    <>
      <Section title="People">
        <Grid>
          <StatCard label="Total users" value={stats.totalUsers} />
          <StatCard label="New (30d)" value={stats.new30} />
          <StatCard label="Signed in (7d)" value={stats.seen7} />
          <StatCard label="In a house" value={stats.inAHouse} />
          <StatCard
            label="No house yet"
            value={stats.noHouse}
            sub={stats.noHouse > 0 ? "never activated" : undefined}
          />
        </Grid>
      </Section>

      <Section title={q ? `${matched} of ${stats.totalUsers} people` : "All people"}>
        <SearchForm view="people" q={q} />
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">Name</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Household</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-4 text-slate-400">
                      {q ? `No one matches “${q}”.` : "No users yet."}
                    </td>
                  </tr>
                ) : (
                  visible.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`${ADMIN_BASE}/directory/u/${u.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {u.name || u.email || "Unnamed"}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{u.email ?? "-"}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {u.houseIds.length ? (
                          <Link
                            href={`${ADMIN_BASE}/directory/h/${u.houseIds[0]}`}
                            className="hover:underline"
                          >
                            {u.houseLabel}
                          </Link>
                        ) : (
                          <span className="text-slate-300">None</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(u.last_sign_in_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pager
          page={page}
          pageCount={pageCount}
          start={start}
          perPage={PER_PAGE}
          matched={matched}
          pageHref={pageHref}
        />
      </Section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function HousesView({
  houses,
  membersOfHouse,
  q,
  ql,
  pageParam,
  pageHref,
  stats,
}: {
  houses: HouseRow[];
  membersOfHouse: Map<string, number>;
  q: string;
  ql: string;
  pageParam: number;
  pageHref: (p: number) => string;
  stats: { total: number; avgSize: string; solo: number; members: number };
}) {
  const rows = ql
    ? houses.filter(
        (h) =>
          h.name.toLowerCase().includes(ql) ||
          (h.address_nickname ?? "").toLowerCase().includes(ql),
      )
    : houses;

  const matched = rows.length;
  const pageCount = Math.max(1, Math.ceil(matched / PER_PAGE));
  const page = Math.min(Math.max(Number.isFinite(pageParam) ? pageParam : 1, 1), pageCount);
  const start = (page - 1) * PER_PAGE;
  const visible = rows.slice(start, start + PER_PAGE);

  return (
    <>
      <Section title="Households">
        <Grid>
          <StatCard label="Total houses" value={stats.total} />
          <StatCard label="Avg. housemates" value={stats.avgSize} />
          <StatCard label="Memberships" value={stats.members} />
          <StatCard label="Solo houses" value={stats.solo} sub="1 member or fewer" />
        </Grid>
      </Section>

      <Section title={q ? `${matched} of ${stats.total} households` : "All households"}>
        <SearchForm view="houses" q={q} />
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">House</th>
                  <th className="px-4 py-2.5 font-medium">Housemates</th>
                  <th className="px-4 py-2.5 font-medium">Currency</th>
                  <th className="px-4 py-2.5 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-slate-400">
                      {q ? `No households match “${q}”.` : "No houses yet."}
                    </td>
                  </tr>
                ) : (
                  visible.map((h) => (
                    <tr
                      key={h.id}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={`${ADMIN_BASE}/directory/h/${h.id}`}
                          className="font-medium text-brand-700 hover:underline"
                        >
                          {h.name}
                        </Link>
                        {h.address_nickname && (
                          <span className="ml-2 text-xs text-slate-400">{h.address_nickname}</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{membersOfHouse.get(h.id) ?? 0}</td>
                      <td className="px-4 py-2.5 text-slate-500">{h.currency}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(h.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <Pager
          page={page}
          pageCount={pageCount}
          start={start}
          perPage={PER_PAGE}
          matched={matched}
          pageHref={pageHref}
        />
      </Section>
    </>
  );
}
