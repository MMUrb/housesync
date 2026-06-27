"use client";

import { useEffect } from "react";

// Registers the service worker on every load (the website and the native
// WebView alike) so the static app shell is cached for fast launches. This is a
// progressive enhancement: the SW only caches immutable, content-hashed static
// assets, never HTML, RSC payloads or API/Supabase responses, so per-user data
// is always fetched fresh. Push subscription (when enabled) reuses this same
// registration.
export function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* registration is best-effort; ignore failures */
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
