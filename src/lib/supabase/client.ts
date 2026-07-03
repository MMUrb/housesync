"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// One shared browser client per tab. Besides avoiding duplicate auth listeners
// and Realtime sockets, a single instance lets us keep the Realtime connection
// authenticated with the user's JWT (below).
let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Supabase client for use in Client Components (browser).
 *
 * IMPORTANT: `createBrowserClient` does NOT push the signed-in user's access
 * token onto the Realtime socket by itself, so Realtime connects with only the
 * anon key. For RLS-protected `postgres_changes` (house chat, live house data)
 * that means the server matches every row against the ANON role and silently
 * delivers nothing. We fix it by setting the Realtime auth token from the
 * session and keeping it in sync on refresh / sign-in / sign-out.
 */
export function createClient() {
  if (client) return client;
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Apply the current session token to Realtime as soon as it's known, then keep
  // it current. onAuthStateChange fires an INITIAL_SESSION event on subscribe,
  // so this also covers the first load.
  supabase.auth.onAuthStateChange((_event, session) => {
    supabase.realtime.setAuth(session?.access_token ?? SUPABASE_ANON_KEY);
  });
  void supabase.auth.getSession().then(({ data }) => {
    if (data.session?.access_token) supabase.realtime.setAuth(data.session.access_token);
  });

  client = supabase;
  return supabase;
}
