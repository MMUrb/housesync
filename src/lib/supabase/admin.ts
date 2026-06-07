import "server-only";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL } from "@/lib/env";

const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export const isAdminConfigured = Boolean(SUPABASE_URL && serviceKey);

/**
 * Service-role Supabase client for background jobs (e.g. the reminders cron).
 * Bypasses RLS, so it must ONLY ever run server-side. Never import this into a
 * Client Component.
 */
export function createAdminClient() {
  if (!isAdminConfigured) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
