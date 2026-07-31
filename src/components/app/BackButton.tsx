"use client";

import { useEffect } from "react";

// Android only: without a JS backButton listener, Capacitor 8 consumes the
// hardware back event and does NOTHING at the history root — the app can't be
// backgrounded with the back button/gesture. This restores the expected
// behaviour: go back through history, or minimize at the root. Registering the
// listener also fixes the already-shipped binaries, since the native side
// changes branch as soon as a listener exists.
export function BackButton() {
  useEffect(() => {
    let remove: (() => void) | undefined;
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (Capacitor.getPlatform() !== "android") return;
        const { App } = await import("@capacitor/app");
        const listener = await App.addListener("backButton", ({ canGoBack }) => {
          if (canGoBack) window.history.back();
          else void App.minimizeApp();
        });
        remove = () => void listener.remove();
      } catch {
        /* plugin unavailable — ignore */
      }
    })();
    return () => remove?.();
  }, []);
  return null;
}
