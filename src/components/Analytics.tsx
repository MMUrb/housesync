"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Cookieless, first-party page-view beacon. Fires once per route change and
 * sends only the path + referrer to /api/track (fire-and-forget).
 */
export function Analytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    try {
      const payload = JSON.stringify({
        path: pathname,
        referrer: typeof document !== "undefined" ? document.referrer || null : null,
      });
      if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/track", payload);
      } else {
        void fetch("/api/track", { method: "POST", body: payload, keepalive: true });
      }
    } catch {
      /* ignore — analytics is best-effort */
    }
  }, [pathname]);

  return null;
}
