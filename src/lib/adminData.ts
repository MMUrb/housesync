import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Shared data helpers for the admin pages (service-role only).

export type AdminUserRow = {
  id: string;
  email?: string;
  created_at?: string;
  last_sign_in_at?: string | null;
};

export const msOf = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

export async function tableCount(admin: SupabaseClient, table: string): Promise<number> {
  const { count } = await admin.from(table).select("*", { count: "exact", head: true });
  return count ?? 0;
}

/** Every auth user (paginated). At low volume this is one or two calls. */
export async function listAllUsers(admin: SupabaseClient): Promise<AdminUserRow[]> {
  const all: AdminUserRow[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    const users = data?.users ?? [];
    all.push(
      ...users.map((u) => ({
        id: u.id,
        email: u.email ?? undefined,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      })),
    );
    if (users.length < 1000) break;
  }
  return all;
}
