// Centralised access to the public environment variables.
// `isSupabaseConfigured` lets the UI show a friendly setup screen instead of
// crashing when the app is run before .env.local has been filled in.

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/**
 * Which social sign-in buttons to show on the login screen.
 * Set NEXT_PUBLIC_OAUTH_PROVIDERS (comma-separated) to control this — e.g.
 * "google,azure" while Apple is still being set up. Defaults to all three.
 * Each provider must ALSO be enabled + configured in the Supabase dashboard.
 */
export const OAUTH_PROVIDERS = (
  process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "google"
)
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter(Boolean);

/** Public base URL of the app, used for invite links and OAuth redirects. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}
