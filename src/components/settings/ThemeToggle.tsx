"use client";

import { useEffect, useState } from "react";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";

export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref | null>(null);

  useEffect(() => {
    setPref(getThemePref());
  }, []);

  function choose(p: ThemePref) {
    setPref(p);
    setThemePref(p);
  }

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-slate-900">Appearance</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Follows your device by default. Pick one to lock it in everywhere.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <ThemeBtn label="System" emoji="🖥️" active={pref === "system"} onClick={() => choose("system")} />
        <ThemeBtn label="Light" emoji="☀️" active={pref === "light"} onClick={() => choose("light")} />
        <ThemeBtn label="Night" emoji="🌙" active={pref === "dark"} onClick={() => choose("dark")} />
      </div>
    </div>
  );
}

function ThemeBtn({
  label,
  emoji,
  active,
  onClick,
}: {
  label: string;
  emoji: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 py-3 text-xs font-semibold transition ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span className="text-base" aria-hidden>
        {emoji}
      </span>
      {label}
    </button>
  );
}
