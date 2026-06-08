import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getUser } from "@/lib/data";
import { isAdminEmail, hasAdminAllowlist } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { NoAccess, AdminLockScreen } from "@/components/admin/AdminUI";

export type AdminGate = { ok: true; user: User } | { ok: false; node: React.ReactNode };

/**
 * The full admin guard, shared by every /admin page:
 *   1. not signed in        -> /login
 *   2. signed in, not admin -> "access required" (shows their email)
 *   3. admin, gate locked   -> password prompt
 *   4. admin, unlocked      -> { ok, user }
 */
export async function adminGate(): Promise<AdminGate> {
  const user = await getUser();
  if (!user) redirect("/login");
  if (!isAdminEmail(user.email)) {
    return { ok: false, node: <NoAccess email={user.email} configured={hasAdminAllowlist} /> };
  }
  if (!(await hasAdminSession(user.id))) {
    return { ok: false, node: <AdminLockScreen email={user.email} /> };
  }
  return { ok: true, user };
}
