"use client";

import { useEffect, useState } from "react";
import { getThemePref, type ThemePref } from "@/lib/theme";

const LABELS: Record<ThemePref, string> = { system: "System", light: "Light", dark: "Night" };

// The Appearance row's right-hand summary. Theme preference lives in
// localStorage, so it can't be known during server render — show nothing for
// a frame rather than a wrong guess.
export function AppearanceValue() {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    setPref(getThemePref());
  }, []);

  if (!pref) return null;
  return <>{LABELS[pref]}</>;
}
