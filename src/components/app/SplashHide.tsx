"use client";

import { useEffect } from "react";

// Native app only: dismiss the launch splash as soon as the page has actually
// painted, so launches go splash -> content with no blank-webview flash in
// between. Mounted in the ROOT layout so it runs on every page (dashboard,
// login, landing). No-ops on the website and in binaries without the plugin.
export function SplashHide() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { SplashScreen } = await import("@capacitor/splash-screen");
        // Two frames = the page is genuinely painted, not just hydrated.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!cancelled) void SplashScreen.hide({ fadeOutDuration: 200 });
          });
        });
      } catch {
        /* plugin absent (old binary) or web — nothing to do */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
