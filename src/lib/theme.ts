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
    const dark = isDark(pref);
    document.documentElement.classList.toggle("dark", dark);
    void applyNativeSystemBars(dark);
  }
}

/**
 * Native apps only: keep the status-bar glyphs readable when the in-app theme
 * diverges from the system appearance (e.g. Night in-app on a Light-mode
 * iPhone left black clock/battery on our near-black header). SystemBars ships
 * inside @capacitor/core 8, so this needs no extra plugin and also fixes the
 * binaries already in people's hands. No-op on the website.
 */
export async function applyNativeSystemBars(dark: boolean): Promise<void> {
  try {
    const { Capacitor, SystemBars, SystemBarsStyle } = await import("@capacitor/core");
    if (!Capacitor.isNativePlatform()) return;
    // Style "Dark" = light glyphs (for dark backgrounds), and vice versa.
    await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
  } catch {
    /* older binary or web — ignore */
  }
}
