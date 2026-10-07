"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { backgroundSignal } from "@/lib/saveWatch";

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
// It runs the moment the app opens, often before the phone's connection is
// up (06-07/10/2026: three "Load failed"s on /dashboard). Waiting for the
// next open would hit the same moment again, so a visit could go unrecorded
// every time; one retry shortly after catches the connection once it's up.
const RETRY_MS = 20_000;

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
    let gone = false;
    let retry: ReturnType<typeof setTimeout> | undefined;

    const record = async (attempt: number): Promise<void> => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || gone) return;
      const { error } = await supabase
        .from("profiles")
        .update({ last_active_at: new Date().toISOString() })
        .eq("id", user.id)
        // Background: nobody waits on it, so a dropped connection here isn't
        // reported as someone stuck (lib/saveWatch); a refusal still is.
        .abortSignal(backgroundSignal());
      if (!error) {
        // Only mark the window as used on success, so a failed write retries.
        try {
          localStorage.setItem(KEY, String(Date.now()));
        } catch {
          /* nothing to do */
        }
        return;
      }
      if (attempt === 0 && !gone) {
        retry = setTimeout(() => void record(1).catch(() => {}), RETRY_MS);
      }
    };

    void record(0).catch(() => {
      /* best-effort: analytics must never disturb the session */
    });
    return () => {
      gone = true;
      if (retry) clearTimeout(retry);
    };
  }, []);
  return null;
}
