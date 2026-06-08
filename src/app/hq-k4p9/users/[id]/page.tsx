import "server-only";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { Avatar } from "@/components/Avatar";
import { ADMIN_BASE } from "@/lib/constants";
import type { AccountSettings, HouseMember } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "User", robots: { index: false, follow: false } };

const DAY = 86_400_000;

function ageLabel(iso?: string | null): string {
  if (!iso) return "—";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
  if (days < 1) return "today";
  if (days < 60) return `${days} day${days === 1 ? "" : "s"}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} months`;
  return `${Math.floor(days / 365)} years`;
}

const fmt = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";

type ProfileRow = {
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  avatar_color: string;
};
type MemberRow = Pick<HouseMember, "house_id" | "role" | "joined_at">;

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const { id } = await params;

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
  const { data: authData } = await admin.auth.admin.getUserById(id);
  const authUser = authData?.user ?? null;

  const [profileRes, settingsRes, membersRes, expensesCount, messagesCount] = await Promise.all([
    admin.from("profiles").select("name, email, avatar_url, avatar_color").eq("id", id).maybeSingle(),
    admin.from("account_settings").select("*").eq("user_id", id).maybeSingle(),
    admin.from("house_members").select("house_id, role, joined_at").eq("user_id", id),
    admin.from("expenses").select("*", { count: "exact", head: true }).eq("created_by", id),
    admin.from("messages").select("*", { count: "exact", head: true }).eq("user_id", id),
  ]);

  const profile = (profileRes.data ?? null) as ProfileRow | null;
  if (!authUser && !profile) notFound();

  const settings = (settingsRes.data ?? null) as AccountSettings | null;
  const memberRows = (membersRes.data ?? []) as MemberRow[];

  let houseNames = new Map<string, string>();
  if (memberRows.length) {
    const { data } = await admin
      .from("houses")
      .select("id, name")
      .in("id", memberRows.map((m) => m.house_id));
    houseNames = new Map(((data ?? []) as { id: string; name: string }[]).map((h) => [h.id, h.name]));
  }

  const email = authUser?.email ?? profile?.email ?? "—";
  const name = profile?.name ?? "—";

  return (
    <AdminShell email={gate.user.email} active="users">
      <div>
        <Link href={`${ADMIN_BASE}/users`} className="text-sm text-slate-400 hover:text-slate-600">
          ← All users
        </Link>
      </div>

      <Section title="Account">
        <div className="card p-5">
          <div className="flex items-center gap-3">
            <Avatar name={name} color={profile?.avatar_color ?? "#6f53f5"} avatarUrl={profile?.avatar_url ?? null} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-slate-900">{name}</p>
              <p className="truncate text-sm text-slate-500">{email}</p>
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Joined" value={fmt(authUser?.created_at)} />
            <Field label="Account age" value={ageLabel(authUser?.created_at)} />
            <Field label="Last seen" value={fmt(authUser?.last_sign_in_at)} />
            <Field label="User ID" value={id} mono wide />
          </dl>
        </div>
      </Section>

      <Section title="Contact & preferences">
        <div className="card p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Phone" value={settings?.phone || "Not set"} />
            <Field label="Phone verified" value={settings?.phone_verified ? "Yes" : "No"} />
            <Field label="Email reminders" value={settings?.notify_email ? "On" : "Off"} />
            <Field label="SMS reminders" value={settings?.notify_sms ? "On" : "Off"} />
          </dl>
        </div>
      </Section>

      <Section title="Activity">
        <Grid>
          <StatCard label="Houses" value={memberRows.length} />
          <StatCard label="Expenses added" value={expensesCount.count ?? 0} />
          <StatCard label="Messages sent" value={messagesCount.count ?? 0} />
        </Grid>
      </Section>

      <Section title="Houses">
        <div className="card divide-y divide-slate-100 p-0">
          {memberRows.length === 0 ? (
            <p className="p-4 text-sm text-slate-400">Not in any house.</p>
          ) : (
            memberRows.map((m) => (
              <div key={m.house_id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {houseNames.get(m.house_id) ?? "Unknown house"}
                  </p>
                  <p className="text-xs text-slate-400">Joined {fmt(m.joined_at)}</p>
                </div>
                <span className="chip bg-slate-100 text-slate-500">{m.role}</span>
              </div>
            ))
          )}
        </div>
      </Section>

      <Section title="Subscription">
        <div className="card p-5">
          <div className="flex items-center gap-2">
            <span className="chip bg-slate-100 text-slate-500">Free</span>
            <span className="text-sm text-slate-400">No billing connected yet</span>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="Plan" value="—" />
            <Field label="Price" value="—" />
            <Field label="Renews" value="—" />
            <Field label="Status" value="—" />
          </dl>
          <p className="mt-3 text-xs text-slate-400">
            This section fills in once payments are added (e.g. Stripe or RevenueCat).
          </p>
        </div>
      </Section>
    </AdminShell>
  );
}

function Field({
  label,
  value,
  mono,
  wide,
}: {
  label: string;
  value: string;
  mono?: boolean;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-sm text-slate-700 ${mono ? "select-all break-all font-mono" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
