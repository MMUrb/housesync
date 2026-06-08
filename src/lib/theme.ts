// Theme preference helpers (client-side). Default is "system" — follow the
// device's prefers-color-scheme. An explicit "light"/"dark" choice is saved to
// localStorage and persists across the website + app until changed.

export type ThemePref = "system" | "light" | "dark";

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return "system";
}

function prefersDark(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function isDark(pref: ThemePref): boolean {
  return pref === "dark" || (pref === "system" && prefersDark());
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem("theme");
    else localStorage.setItem("theme", pref);
  } catch {
    /* ignore */
  }
  if (typeof document !== "undefined") {
    document.documentElement.classList.toggle("dark", isDark(pref));
  }
}
