"use client";

import { useEffect } from "react";

// Native app (Capacitor) only: flags <html> with `.native-app` so CSS can move
// the primary nav from the top bar down to a fixed bottom tab bar, which is the
// phone-native pattern. In a normal browser Capacitor isn't native, so this is a
// no-op and the website keeps its top navigation.
//
// Also tracks the on-screen keyboard via visualViewport: while it's up, <html>
// gets `.kb-open` so CSS can hide the bottom tab bar (otherwise it floats on
// top of the keyboard while you type).
export function NativeShell() {
  useEffect(() => {
    let active = true;
    let removeKb = () => {};
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!active || !Capacitor.isNativePlatform()) return;
        document.documentElement.classList.add("native-app");

        const vv = window.visualViewport;
        if (vv) {
          // On Android (adjustResize) the WHOLE window shrinks with the
          // keyboard, so comparing vv.height to window.innerHeight never
          // triggers — both shrink together. Compare against the tallest
          // viewport seen instead (stable: the app is portrait-locked).
          let maxHeight = vv.height;
          const onResize = () => {
            maxHeight = Math.max(maxHeight, vv.height);
            const kbOpen = maxHeight - vv.height > 150;
            document.documentElement.classList.toggle("kb-open", kbOpen);
          };
          onResize();
          vv.addEventListener("resize", onResize);
          removeKb = () => {
            vv.removeEventListener("resize", onResize);
            document.documentElement.classList.remove("kb-open");
          };
        }
      } catch {
        /* not running natively — leave the website layout as-is */
      }
    })();
    return () => {
      active = false;
      removeKb();
    };
  }, []);
  return null;
}
