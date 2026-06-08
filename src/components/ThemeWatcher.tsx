"use client";

import { useEffect } from "react";

/**
 * Keeps the applied theme correct on every page:
 *  - follows the device theme while in "system" mode (live, if the OS flips),
 *  - re-applies an explicit choice changed in another tab.
 */
export function ThemeWatcher() {
  useEffect(() => {
    function resolve() {
      let t: string | null = null;
      try {
        t = localStorage.getItem("theme");
      } catch {
        /* ignore */
      }
      const dark =
        t === "dark" ||
        (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
    }

    function onStorage(e: StorageEvent) {
      if (e.key === "theme") resolve();
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", resolve);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", resolve);
    };
  }, []);

  return null;
}
