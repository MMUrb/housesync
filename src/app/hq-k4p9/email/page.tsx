import "server-only";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { adminGate } from "@/components/admin/guard";
import { AdminShell } from "@/components/admin/AdminUI";
import { EmailComposer, type SentRow } from "@/components/admin/EmailComposer";
import { loadEmailAudience } from "@/lib/emailAudience";
import type { Person } from "@/lib/broadcast";

export const dynamic = "force-dynamic";
export const metadata = { title: "Email", robots: { index: false, follow: false } };

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });

export default async function EmailPage() {
  const gate = await adminGate();
  if (!gate.ok) return gate.node;

  if (!isAdminConfigured) {
    return (
      <AdminShell email={gate.user.email} active="email">
        <p className="card p-4 text-sm text-slate-600">
          Set <code>SUPABASE_SERVICE_ROLE_KEY</code> to send emails.
        </p>
      </AdminShell>
    );
  }

  const admin = createAdminClient();
  let people: Person[] = [];
  let loadError: string | null = null;
  try {
    people = await loadEmailAudience(admin);
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Couldn't load recipients.";
  }
  const { data: history, error: historyErr } = await admin
    .from("email_broadcasts")
    .select("id, created_at, kind, subject, recipients, sent, failed")
    .order("created_at", { ascending: false })
    .limit(20);

  // Times formatted here, on the server, so the client component never
  // formats locale-dependent text during hydration.
  const sent: SentRow[] = (
    (history ?? []) as {
      id: string;
      created_at: string;
      kind: string;
      subject: string;
      recipients: number;
      sent: number;
      failed: number;
    }[]
  ).map((r) => ({ ...r, when: fmt(r.created_at) }));

  return (
    <AdminShell email={gate.user.email} active="email">
      {loadError ? (
        <p className="card p-4 text-sm text-red-700">
          Can&rsquo;t send right now: {loadError}. (Sending without everyone&rsquo;s email choices
          could reach people who opted out.)
        </p>
      ) : (
        <EmailComposer
          people={people}
          history={sent}
          historyMissing={Boolean(historyErr)}
          adminName={people.find((p) => p.id === gate.user.id)?.name ?? null}
        />
      )}
    </AdminShell>
  );
}
