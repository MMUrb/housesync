"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read the theme already applied to <html> by the no-flash script.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  function apply(next: Theme) {
    setTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* ignore */
    }
    document.documentElement.classList.toggle("dark", next === "dark");
  }

  return (
    <div className="card p-5">
      <p className="text-sm font-bold text-slate-900">Appearance</p>
      <p className="mt-0.5 text-xs text-slate-500">Choose how HouseSync looks on this device.</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <ThemeBtn label="Light" emoji="☀️" active={theme === "light"} onClick={() => apply("light")} />
        <ThemeBtn label="Night" emoji="🌙" active={theme === "dark"} onClick={() => apply("dark")} />
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
      className={`flex items-center justify-center gap-2 rounded-xl border-2 py-3 text-sm font-semibold transition ${
        active
          ? "border-brand-600 bg-brand-50 text-brand-700"
          : "border-slate-200 text-slate-600 hover:bg-slate-50"
      }`}
    >
      <span aria-hidden>{emoji}</span>
      {label}
    </button>
  );
}
