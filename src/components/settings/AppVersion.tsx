"use client";

import { useEffect, useState } from "react";

// The site's release version, shown on web where there is no binary version.
const WEB_VERSION = "1.1.1";

// Settings footer version line. In the native apps this reads the REAL binary
// version, so testers and store reviewers always see the build they're on
// (a hardcoded string went stale the moment the next binary shipped).
export function AppVersion() {
  const [version, setVersion] = useState(WEB_VERSION);

  useEffect(() => {
    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;
        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (info.version) setVersion(info.version);
      } catch {
        /* keep the web fallback */
      }
    })();
  }, []);

  return <p className="text-xs text-slate-400">HouseSync · v{version}</p>;
}
