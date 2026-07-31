import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { Avatar } from "@/components/Avatar";
import { ADMIN_BASE } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { DAY } from "@/lib/adminMetrics";
import type { AccountSettings } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Person", robots: { index: false, follow: false } };

type ProfileRow = {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
};
type MemberRow = { house_id: string; role: string; joined_at: string };
type HouseRow = {
  id: string;
  name: string;
  currency: string;
  rent_due_day: number | null;
  invite_code: string;
  created_at: string;
};
type ActivityRow = { type: string; message: string; created_at: string; house_id: string };

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }) : "-";

function ageLabel(iso?: string | null): string {
  if (!iso) return "-";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} years`;
}

function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  const mo = Math.round(d / 30);
  return mo < 12 ? `${mo} month${mo === 1 ? "" : "s"} ago` : `${Math.round(mo / 12)} years ago`;
}

export default async function PersonRecordPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const { id } = await params;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="directory">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to view this record.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();

  const { data: authData } = await admin.auth.admin.getUserById(id);
  const authUser = authData?.user ?? null;

  const [
    profileRes,
    settingsRes,
    membersRes,
    expensesCount,
    messagesCount,
    choresCount,
    activityRes,
    pushRes,
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id, name, email, avatar_url, avatar_color")
      .eq("id", id)
      .maybeSingle(),
    admin.from("account_settings").select("*").eq("user_id", id).maybeSingle(),
    admin.from("house_members").select("house_id, role, joined_at").eq("user_id", id),
    admin.from("expenses").select("*", { count: "exact", head: true }).eq("created_by", id),
    admin.from("messages").select("*", { count: "exact", head: true }).eq("user_id", id),
    admin
      .from("chores")
      .select("*", { count: "exact", head: true })
      .eq("completed_by", id)
      .not("completed_at", "is", null),
    admin
      .from("activity")
      .select("type, message, created_at, house_id")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(12),
    admin.from("push_subscriptions").select("platform").eq("user_id", id),
  ]);

  const profile = (profileRes.data ?? null) as ProfileRow | null;
  if (!authUser && !profile) notFound();

  const settings = (settingsRes.data ?? null) as AccountSettings | null;
  const memberRows = (membersRes.data ?? []) as MemberRow[];
  const timeline = (activityRes.data ?? []) as ActivityRow[];
  const devices = (pushRes.data ?? []) as { platform: string | null }[];

  // Actions in the last 30 days, the same signal the Engagement tab uses.
  const [recentActs, recentMsgs] = await Promise.all([
    admin
      .from("activity")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .gte("created_at", since30),
    admin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .gte("created_at", since30),
  ]);
  const actions30 = (recentActs.count ?? 0) + (recentMsgs.count ?? 0);

  // Their households, fully expanded rather than just named.
  let houses: HouseRow[] = [];
  let matesByHouse = new Map<string, { user_id: string; role: string; joined_at: string }[]>();
  let mateProfiles = new Map<string, ProfileRow>();
  let spendByHouse = new Map<string, number>();

  if (memberRows.length) {
    const houseIds = memberRows.map((m) => m.house_id);
    const [housesRes, matesRes, expRes] = await Promise.all([
      admin
        .from("houses")
        .select("id, name, currency, rent_due_day, invite_code, created_at")
        .in("id", houseIds),
      admin.from("house_members").select("house_id, user_id, role, joined_at").in("house_id", houseIds),
      admin.from("expenses").select("house_id, amount").in("house_id", houseIds).limit(10_000),
    ]);

    houses = (housesRes.data ?? []) as HouseRow[];

    const mates = (matesRes.data ?? []) as {
      house_id: string;
      user_id: string;
      role: string;
      joined_at: string;
    }[];
    matesByHouse = new Map();
    for (const m of mates) {
      const list = matesByHouse.get(m.house_id) ?? [];
      list.push({ user_id: m.user_id, role: m.role, joined_at: m.joined_at });
      matesByHouse.set(m.house_id, list);
    }

    const mateIds = [...new Set(mates.map((m) => m.user_id))];
    if (mateIds.length) {
      const { data } = await admin
        .from("profiles")
        .select("id, name, email, avatar_url, avatar_color")
        .in("id", mateIds);
      mateProfiles = new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, p]));
    }

    for (const e of (expRes.data ?? []) as { house_id: string; amount: number | string }[]) {
      spendByHouse.set(e.house_id, (spendByHouse.get(e.house_id) ?? 0) + Number(e.amount ?? 0));
    }
  }

  const email = authUser?.email ?? profile?.email ?? "-";
  const name = profile?.name ?? "-";
  const provider = authUser?.app_metadata?.provider ?? "email";
  const platforms = [...new Set(devices.map((d) => d.platform ?? "web"))];

  return (
    <AdminShell email={gate.user.email} active="directory">
      <div>
        <Link
          href={`${ADMIN_BASE}/directory`}
          className="text-sm text-slate-400 hover:text-slate-600"
        >
          ← All people
        </Link>
      </div>

      <Section title="Account">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar
              name={name}
              color={profile?.avatar_color ?? "#6f53f5"}
              avatarUrl={profile?.avatar_url ?? null}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{name}</p>
              <p className="truncate text-sm text-slate-500">{email}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Joined" value={fmt(authUser?.created_at)} />
            <Field label="Account age" value={ageLabel(authUser?.created_at)} />
            <Field label="Last signed in" value={fmt(authUser?.last_sign_in_at)} />
            <Field label="Sign-in method" value={provider} />
            <Field
              label="Email confirmed"
              value={authUser?.email_confirmed_at ? "Yes" : "No"}
            />
            <Field label="Devices" value={platforms.length ? platforms.join(", ") : "None"} />
            <Field label="Households" value={String(memberRows.length)} />
            <Field label="User ID" value={id} mono />
          </dl>
        </div>
      </Section>

      <Section title="Their activity">
        <Grid>
          <StatCard label="Actions (30d)" value={actions30} />
          <StatCard label="Expenses added" value={expensesCount.count ?? 0} />
          <StatCard label="Messages sent" value={messagesCount.count ?? 0} />
          <StatCard label="Chores completed" value={choresCount.count ?? 0} />
        </Grid>
      </Section>

      {houses.length === 0 ? (
        <Section title="Household">
          <div className="card p-5 text-sm text-slate-500">
            Not in any house. They signed up but never joined or created one.
          </div>
        </Section>
      ) : (
        houses.map((h) => {
          const mates = matesByHouse.get(h.id) ?? [];
          const mine = memberRows.find((m) => m.house_id === h.id);
          const spend = spendByHouse.get(h.id) ?? 0;
          return (
            <Section
              key={h.id}
              title={`Household · ${h.name}`}
              action={
                <Link
                  href={`${ADMIN_BASE}/directory/h/${h.id}`}
                  className="text-xs font-medium text-brand-600 hover:underline"
                >
                  Open household record →
                </Link>
              }
            >
              <div className="card p-5">
                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Their role" value={mine?.role ?? "-"} />
                  <Field label="Joined house" value={fmt(mine?.joined_at)} />
                  <Field label="Housemates" value={String(mates.length)} />
                  <Field label="Currency" value={h.currency} />
                  <Field
                    label="Rent due day"
                    value={h.rent_due_day ? String(h.rent_due_day) : "Not set"}
                  />
                  <Field label="Tracked spend" value={formatMoney(spend, h.currency)} />
                  <Field label="House created" value={fmt(h.created_at)} />
                  <Field label="Invite code" value={h.invite_code} mono />
                </dl>

                <div className="mt-5 border-t border-slate-100 pt-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Housemates
                  </p>
                  <div className="divide-y divide-slate-100">
                    {mates.map((m) => {
                      const p = mateProfiles.get(m.user_id);
                      const isThisPerson = m.user_id === id;
                      return (
                        <div
                          key={m.user_id}
                          className="flex items-center justify-between gap-3 py-2.5"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <Avatar
                              name={p?.name ?? "?"}
                              color={p?.avatar_color ?? "#6f53f5"}
                              avatarUrl={p?.avatar_url ?? null}
                            />
                            <div className="min-w-0">
                              {isThisPerson ? (
                                <p className="truncate text-sm font-medium text-slate-800">
                                  {p?.name ?? name}
                                </p>
                              ) : (
                                <Link
                                  href={`${ADMIN_BASE}/directory/u/${m.user_id}`}
                                  className="block truncate text-sm font-medium text-brand-700 hover:underline"
                                >
                                  {p?.name ?? "Unknown"}
                                </Link>
                              )}
                              <p className="truncate text-xs text-slate-400">
                                {p?.email ?? "-"} · joined {fmt(m.joined_at)}
                              </p>
                            </div>
                          </div>
                          <span className="chip shrink-0 bg-slate-100 text-slate-500">
                            {isThisPerson ? "this person" : m.role}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Section>
          );
        })
      )}

      <Section title="Recent activity">
        <div className="card divide-y divide-slate-100 p-0">
          {timeline.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Nothing recorded yet.</p>
          ) : (
            timeline.map((a, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-4">
                <p className="min-w-0 text-sm text-slate-700">{a.message}</p>
                <span
                  className="shrink-0 text-xs text-slate-400"
                  title={fmt(a.created_at)}
                >
                  {relTime(a.created_at)}
                </span>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Notifications">
        <div className="card p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Email reminders" value={settings?.notify_email ? "On" : "Off"} />
            <Field label="Bill emails" value={settings?.notify_email_bills ? "On" : "Off"} />
            <Field label="Nudge emails" value={settings?.notify_email_nudges ? "On" : "Off"} />
            <Field label="Push devices" value={String(devices.length)} />
          </dl>
        </div>
      </Section>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd
        className={`mt-0.5 text-sm text-slate-700 ${mono ? "select-all break-all font-mono text-xs" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}
