"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Records that a signed-in person opened the app, so the admin directory can
// show a real "last seen". auth.last_sign_in_at can't: Supabase only moves it
// on a fresh authentication, and our sessions persist, so daily users kept the
// timestamp from the day they signed up.
//
// Throttled per device so normal navigation costs no writes: one update an
// hour is plenty for a "last seen" column, and the only cost of a missed
// window is a slightly stale timestamp.
const EVERY_MS = 60 * 60 * 1000;
const KEY = "hs_seen_at";

export function LastSeenBeacon() {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(localStorage.getItem(KEY)) || 0;
    } catch {
      /* private mode: fall through and write once this page load */
    }
    if (Date.now() - last < EVERY_MS) return;

    const supabase = createClient();
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        const user = session?.user;
        if (!user) return;
        return supabase
          .from("profiles")
          .update({ last_active_at: new Date().toISOString() })
          .eq("id", user.id)
          .then(({ error }) => {
            // Only mark the window as used on success, so a failed write (or a
            // deploy that landed before migration 0041) retries next load.
            if (error) return;
            try {
              localStorage.setItem(KEY, String(Date.now()));
            } catch {
              /* nothing to do */
            }
          });
      })
      .catch(() => {
        /* best-effort — analytics must never disturb the session */
      });
  }, []);
  return null;
}
