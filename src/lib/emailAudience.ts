import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { listAllUsers } from "@/lib/adminData";
import type { Person } from "@/lib/broadcast";

/**
 * Everyone with an account, as the admin Email tab sees them: the email they
 * signed up with (the auth email, not the editable profile copy), name, first
 * house, and their email switches. No settings row means the defaults (on).
 * Throws if the switches can't be read: sending without them could email
 * people who opted out.
 */
export async function loadEmailAudience(admin: SupabaseClient): Promise<Person[]> {
  const [users, settingsRes, profilesRes, membersRes] = await Promise.all([
    listAllUsers(admin),
    admin.from("account_settings").select("user_id, notify_email, notify_email_news"),
    admin.from("profiles").select("id, name"),
    admin.from("house_members").select("user_id, house_id"),
  ]);
  if (settingsRes.error) throw new Error(`email settings unreadable: ${settingsRes.error.message}`);

  const settings = new Map(
    ((settingsRes.data ?? []) as { user_id: string; notify_email: boolean | null; notify_email_news: boolean | null }[]).map(
      (s) => [s.user_id, s],
    ),
  );
  const names = new Map(
    ((profilesRes.data ?? []) as { id: string; name: string | null }[]).map((p) => [p.id, p.name]),
  );
  const members = (membersRes.data ?? []) as { user_id: string; house_id: string }[];
  const houseIds = [...new Set(members.map((m) => m.house_id))];
  const houseNames = new Map<string, string>();
  for (let i = 0; i < houseIds.length; i += 100) {
    const { data } = await admin.from("houses").select("id, name").in("id", houseIds.slice(i, i + 100));
    for (const h of (data ?? []) as { id: string; name: string }[]) houseNames.set(h.id, h.name);
  }
  const firstHouse = new Map<string, string>();
  for (const m of members) {
    if (!firstHouse.has(m.user_id)) firstHouse.set(m.user_id, houseNames.get(m.house_id) ?? "");
  }

  return users
    .map((u) => {
      const s = settings.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        name: names.get(u.id) ?? null,
        house: firstHouse.get(u.id) || null,
        emailOn: s?.notify_email !== false,
        newsOn: s?.notify_email_news !== false,
      };
    })
    .sort((a, b) => (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "", "en-GB"));
}
