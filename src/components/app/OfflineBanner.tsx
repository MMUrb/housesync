"use client";

import { useEffect, useState } from "react";

/**
 * Thin strip under the nav while the device has no connection.
 *
 * Nothing in the app queues writes offline, so without this a tap that fails
 * just looks broken. It sits in the flow of the sticky header rather than
 * floating over the page: floating looked tidier on paper but permanently
 * hid the top of whatever was underneath, and connectivity changes are rare
 * enough that a one-off nudge of the content is the better trade. Colours
 * are literal rather than the amber utilities because the dark theme remaps
 * bg-amber-50 to a translucent tint.
 */
export function OfflineBanner() {
  // Assume online for the first paint so the server and client agree.
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-center gap-2 border-t border-amber-200/70 bg-[#fffbeb] px-3 py-1.5 text-center text-xs font-semibold text-amber-700 dark:border-white/10 dark:bg-[#2b2412]"
    >
      <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
      No connection. Changes won&rsquo;t save right now.
    </div>
  );
}
