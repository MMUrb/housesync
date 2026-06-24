"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { IconChevronDown } from "@/components/icons";

type PrefKey = "bills" | "nudges" | "product" | "tips" | "surveys" | "offers";
export type EmailPrefs = Record<PrefKey, boolean>;

// Each toggle and the account_settings column it writes to.
const TYPES: { key: PrefKey; col: string; label: string; desc: string }[] = [
  { key: "bills", col: "notify_email_bills", label: "Bill reminders", desc: "When a recurring bill is due soon" },
  { key: "nudges", col: "notify_email_nudges", label: "Payment reminders", desc: "A weekly nudge when you owe money" },
  { key: "product", col: "notify_email_product", label: "Product updates", desc: "New features and improvements" },
  { key: "tips", col: "notify_email_tips", label: "Tips and guides", desc: "Getting the most out of HouseSync" },
  { key: "surveys", col: "notify_email_surveys", label: "Surveys and feedback", desc: "Occasional requests for your input" },
  { key: "offers", col: "notify_email_offers", label: "Special offers", desc: "Deals and promotions" },
];

function Switch({ checked, onClick, label }: { checked: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? "bg-brand-600" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${checked ? "left-[22px]" : "left-0.5"}`}
      />
    </button>
  );
}

/**
 * Granular email opt-out. A collapsible panel of per-type toggles (mirrors the
 * push notification preferences). Each saves to its own account_settings column.
 */
export function EmailToggle({ userId, initialPrefs }: { userId: string; initialPrefs: EmailPrefs }) {
  const supabase = createClient();
  const [prefs, setPrefs] = useState<EmailPrefs>(initialPrefs);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function savePref(key: PrefKey, col: string, value: boolean) {
    setPrefs((p) => ({ ...p, [key]: value }));
    const { error: upErr } = await supabase
      .from("account_settings")
      .upsert({ user_id: userId, [col]: value }, { onConflict: "user_id" });
    if (upErr) {
      setPrefs((p) => ({ ...p, [key]: !value })); // revert on failure
      setError("Couldn't save that preference. Please try again.");
    }
  }

  return (
    <div className="card p-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3"
      >
        <div className="pr-2 text-left">
          <p className="text-sm font-medium text-slate-800">Email preferences</p>
          <p className="text-xs text-slate-500">Choose which emails HouseSync sends you.</p>
        </div>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          <ul className="mt-4 space-y-3 border-t border-slate-100 pt-4">
            {TYPES.map((t) => (
              <li key={t.key} className="flex items-center justify-between gap-3">
                <div className="pr-2">
                  <p className="text-sm text-slate-700">{t.label}</p>
                  <p className="text-xs text-slate-500">{t.desc}</p>
                </div>
                <Switch
                  checked={prefs[t.key]}
                  onClick={() => savePref(t.key, t.col, !prefs[t.key])}
                  label={t.label}
                />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-slate-400">
            Account and security emails (sign-in, verification, password) are always sent.
          </p>
        </>
      )}

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
