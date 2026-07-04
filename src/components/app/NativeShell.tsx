"use client";

import { useEffect } from "react";

// Native app (Capacitor) only: flags <html> with `.native-app` so CSS can move
// the primary nav from the top bar down to a fixed bottom tab bar, which is the
// phone-native pattern. In a normal browser Capacitor isn't native, so this is a
// no-op and the website keeps its top navigation.
export function NativeShell() {
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (active && Capacitor.isNativePlatform()) {
          document.documentElement.classList.add("native-app");
        }
      } catch {
        /* not running natively — leave the website layout as-is */
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  return null;
}
