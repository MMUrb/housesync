"use client";

import type { SaveWatchEnv } from "@/lib/saveWatch";

// What the save watch needs to know about the browser, shared by the database
// client (lib/supabase/client) and our own API calls (lib/actionFetch) so both
// apply the same rules.

// When this tab last went into the background. A request that spanned that
// moment was killed by the OS, not lost by the person.
let lastHiddenAt = 0;
let listening = false;

export function browserWatchEnv(): SaveWatchEnv {
  if (!listening && typeof document !== "undefined") {
    listening = true;
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") lastHiddenAt = Date.now();
    });
  }
  return {
    isVisible: () => typeof document === "undefined" || document.visibilityState === "visible",
    isOnline: () => typeof navigator === "undefined" || navigator.onLine !== false,
    lastHiddenAt: () => lastHiddenAt,
    now: () => Date.now(),
  };
}
