"use client";

import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";

// One shared browser client per tab (avoids duplicate auth listeners / Realtime
// sockets; all channels share one authenticated connection).
let client: ReturnType<typeof createBrowserClient> | undefined;

/**
 * Read the signed-in user's access token straight from the Supabase auth cookie,
 * SYNCHRONOUSLY. `@supabase/ssr` stores the session in `sb-<ref>-auth-token`
 * cookies (chunked `.0`, `.1`, ... when large) as base64-prefixed JSON.
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
    return (JSON.parse(raw) as { access_token?: string })?.access_token ?? null;
  } catch {
    return null;
  }
}

/** Supabase client for use in Client Components (browser). */
export function createClient() {
  if (client) return client;
  const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Make Realtime authenticate as the signed-in user.
  //
  // supabase-js sets the Realtime token ASYNCHRONOUSLY (it awaits its
  // getSession-based `accessToken` callback, then calls setAuth). On a fresh SSR
  // tab our components subscribe synchronously right after this, so the channel
  // joins BEFORE that token resolves and RLS-protected postgres_changes (house
  // chat + live house data) are silently dropped as the anon role.
  //
  // Fix: put the JWT on the socket synchronously (so it's already in the very
  // first channel JOIN), and repoint the callback at the cookie so reconnects /
  // token refreshes stay authenticated. `accessTokenValue` is the field the
  // channel reads when building its join payload.
  const token = sessionAccessToken();
  const rt = supabase.realtime as unknown as {
    accessTokenValue?: string | null;
    accessToken?: (() => Promise<string | null>) | null;
  };
  if (token) rt.accessTokenValue = token;
  rt.accessToken = async () => sessionAccessToken() ?? SUPABASE_ANON_KEY;

  if (typeof window !== "undefined") {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const w = window as any;
    w.__hsRealtimeAuth = token ? "jwt" : "anon";
    w.__hsClient = supabase;
    w.__hsDbg = [];
    const snap = (label: string) => {
      try {
        w.__hsDbg.push({
          label,
          t: Date.now(),
          atv: String(rt.accessTokenValue ?? "").slice(0, 10),
          connected: (supabase.realtime as any).isConnected?.() ?? null,
          channels: (supabase.getChannels?.() ?? []).map((c: any) => ({ topic: c.topic, state: c.state })),
        });
      } catch (e) {
        w.__hsDbg.push({ label, err: String(e) });
      }
    };
    snap("create");
    setTimeout(() => snap("t150"), 150);
    setTimeout(() => snap("t1500"), 1500);
    setTimeout(() => snap("t4000"), 4000);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  client = supabase;
  return supabase;
}
