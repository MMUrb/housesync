import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell, Section, Grid, StatCard } from "@/components/admin/AdminUI";
import { WaitlistBroadcast } from "@/components/admin/WaitlistBroadcast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Waitlist", robots: { index: false, follow: false } };

const DAY = 86_400_000;

type Signup = { email: string; source: string | null; created_at: string };
type Unlock = {
  country: string | null;
  city: string | null;
  user_agent: string | null;
  visitor_hash: string | null;
  created_at: string;
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });

/** Friendly "OS · Browser" label from a raw user-agent string. */
function deviceLabel(ua: string | null): string {
  if (!ua) return "Unknown";
  const os = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Macintosh|Mac OS X/i.test(ua)
          ? "Mac"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Other";
  const browser = /Capacitor|; wv\)|HouseSync/i.test(ua)
    ? "App"
    : /Edg\//i.test(ua)
      ? "Edge"
      : /CriOS|Chrome/i.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox/i.test(ua)
          ? "Firefox"
          : /Safari/i.test(ua)
            ? "Safari"
            : "Browser";
  return `${os} · ${browser}`;
}

export default async function WaitlistAdminPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;
  const user = gate.user;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={user.email} active="waitlist">
        <p className="card p-4 text-sm text-slate-600">
          Analytics isn&rsquo;t configured yet: set <code>SUPABASE_SERVICE_ROLE_KEY</code> and reload.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  const [signupsRes, unlocksRes] = await Promise.all([
    admin
      .from("waitlist")
      .select("email, source, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("waitlist_unlocks")
      .select("country, city, user_agent, visitor_hash, created_at")
      .order("created_at", { ascending: false })
      .limit(2000),
  ]);

  const signups = (signupsRes.data ?? []) as Signup[];
  const unlocks = (unlocksRes.data ?? []) as Unlock[];

  const d7 = Date.now() - 7 * DAY;
  const signups7 = signups.filter((s) => new Date(s.created_at).getTime() >= d7).length;
  const unlocks7 = unlocks.filter((u) => new Date(u.created_at).getTime() >= d7).length;

  return (
    <AdminShell email={user.email} active="waitlist">
      <Section title="Waitlist">
        <Grid>
          <StatCard label="Total sign-ups" value={signups.length} sub={`${signups7} this week`} />
          <StatCard label="Code unlocks" value={unlocks.length} sub={`${unlocks7} this week`} />
        </Grid>
      </Section>

      <Section title="Broadcast">
        <WaitlistBroadcast count={signups.length} />
      </Section>

      <Section
        title="Sign-ups"
        action={<span className="text-xs text-slate-400">{signups.length} total</span>}
      >
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">#</th>
                  <th className="px-4 py-2.5 font-medium">Email</th>
                  <th className="px-4 py-2.5 font-medium">Joined</th>
                  <th className="px-4 py-2.5 font-medium">Source</th>
                </tr>
              </thead>
              <tbody>
                {signups.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-4 text-slate-400">
                      No sign-ups yet.
                    </td>
                  </tr>
                ) : (
                  signups.map((s, i) => (
                    <tr
                      key={s.email}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 text-slate-400">{signups.length - i}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-700">{s.email}</td>
                      <td className="px-4 py-2.5 text-slate-500">{fmt(s.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">{s.source ?? "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Section>

      <Section
        title="Access-code unlocks"
        action={<span className="text-xs text-slate-400">{unlocks.length} total</span>}
      >
        <p className="-mt-1 text-xs text-slate-400">
          People who entered the access code to get past the waitlist. They&rsquo;re anonymous until
          they create an account. Only the time, rough location and device are recorded (no IPs).
        </p>
        <div className="card p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">Location</th>
                  <th className="px-4 py-2.5 font-medium">Device</th>
                </tr>
              </thead>
              <tbody>
                {unlocks.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-4 text-slate-400">
                      No one has used the access code yet.
                    </td>
                  </tr>
                ) : (
                  unlocks.map((u, i) => (
                    <tr
                      key={`${u.created_at}-${i}`}
                      className="border-b border-slate-50 last:border-0 hover:bg-slate-50"
                    >
                      <td className="px-4 py-2.5 text-slate-500">{fmt(u.created_at)}</td>
                      <td className="px-4 py-2.5 text-slate-500">
                        {[u.city, u.country].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{deviceLabel(u.user_agent)}</td>
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
