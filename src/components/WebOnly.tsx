"use client";

import { useEffect, useState } from "react";

// Renders children on the website only, hiding them inside the Capacitor apps.
// The landing page renders outside the (app) shell, so it can't rely on the
// `.native-app` class NativeShell sets — this checks Capacitor directly.
// Defaults to visible so the website (the overwhelmingly common case) never
// flashes; native hides it right after mount.
export function WebOnly({ children }: { children: React.ReactNode }) {
  const [native, setNative] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void import("@capacitor/core").then(({ Capacitor }) => {
      if (!cancelled && Capacitor.isNativePlatform()) setNative(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (native) return null;
  return <>{children}</>;
}
