"use client";

import { useEffect } from "react";

/** Keeps the theme in sync across open tabs/windows when it's changed elsewhere. */
export function ThemeWatcher() {
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "theme") {
        document.documentElement.classList.toggle("dark", e.newValue === "dark");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return null;
}
