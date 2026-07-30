"use client";

import { useEffect, useState } from "react";
import { getThemePref, type ThemePref } from "@/lib/theme";

const LABELS: Record<ThemePref, string> = { system: "System", light: "Light", dark: "Night" };

// The Appearance row's right-hand summary. Theme preference lives in
// localStorage, so it can't be known during server render — show nothing for
// a frame rather than a wrong guess.
export function AppearanceValue({ displayCurrency }: { displayCurrency: string | null }) {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    setPref(getThemePref());
  }, []);

  if (!pref) return displayCurrency ? <>also in {displayCurrency}</> : null;
  return (
    <>
      {LABELS[pref]}
      {displayCurrency ? ` · also in ${displayCurrency}` : ""}
    </>
  );
}
