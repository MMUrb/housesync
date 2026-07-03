"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// One shared browser client per tab (avoids duplicate auth listeners / Realtime
// sockets, and lets every channel share one authenticated connection).
let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Read the signed-in user's access token straight from the Supabase auth cookie,
 * SYNCHRONOUSLY. `@supabase/ssr` stores the session in a `sb-<ref>-auth-token`
 * cookie (chunked as `.0`, `.1`, ... when large), base64-prefixed JSON.
 *
 * We need this synchronously because Realtime authorises RLS-protected
 * `postgres_changes` at channel-JOIN time. If we set the token asynchronously
 * (after `getSession()`), the channel has usually already joined with the anon
 * key, so the server matches rows against the ANON role and delivers nothing.
 */
function sessionAccessToken(): string | null {
  if (typeof document === "undefined") return null;
  const ref = SUPABASE_URL.replace(/^https?:\/\//, "").split(".")[0];
  const prefix = `sb-${ref}-auth-token`;
  const parts = document.cookie
    .split("; ")
    .map((c) => {
      const eq = c.indexOf("=");
      return { name: c.slice(0, eq), value: c.slice(eq + 1) };
    })
    .filter((c) => c.name === prefix || c.name.startsWith(`${prefix}.`))
    .sort((a, b) => a.name.localeCompare(b.name)); // base, then .0, .1, ...
  if (parts.length === 0) return null;
  let raw = parts.map((p) => decodeURIComponent(p.value)).join("");
  if (raw.startsWith("base64-")) {
    try {
      raw = atob(raw.slice(7));
    } catch {
      return null;
    }
  }
  try {
    const parsed = JSON.parse(raw) as { access_token?: string };
    return parsed?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Supabase client for use in Client Components (browser). */
export function createClient() {
  if (client) return client;
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Authenticate Realtime with the user's JWT up front, before any channel
  // subscribes, so RLS-protected postgres_changes (house chat + live house data)
  // are actually delivered instead of silently dropped as the anon role.
  const token = sessionAccessToken();
  if (token) supabase.realtime.setAuth(token);

  // Keep it current on refresh / sign-in / sign-out.
  supabase.auth.onAuthStateChange((_event, session) => {
    supabase.realtime.setAuth(session?.access_token ?? SUPABASE_ANON_KEY);
  });

  client = supabase;
  return supabase;
}
