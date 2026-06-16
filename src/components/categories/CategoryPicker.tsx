"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PickerCat = { code: string; name: string; emoji: string; color: string };

// A curated set of emojis that cover the bills/expenses people usually add, so
// a custom category (e.g. a taxi bill) can be matched to a fitting icon.
const PRESET_EMOJIS = [
  "🚗", "🚕", "🚌", "🚆", "✈️", "⛽", "🚲", "🅿️",
  "💡", "🔌", "🔥", "💧", "📶", "📱", "💻", "📺",
  "🎬", "🎵", "🎮", "🎧", "📚", "🍺", "☕", "🍕",
  "🛒", "🍽️", "🧽", "🧹", "🧴", "🧺", "🛁", "🧻",
  "🛋️", "🪴", "🔧", "🐶", "💊", "🏋️", "💳", "🧾",
];

// Auto-assign a colour to new categories (the house can recolour later in
// Settings → Categories). Mirrors CategoryManager's palette.
const PALETTE = ["#6f53f5", "#3f9fe0", "#1bb27e", "#e0567f", "#e0b53f", "#9b5fe0", "#ef4444", "#94a3b8"];

/**
 * Category chooser used by the add-expense and add-bill forms. Picking "Other"
 * opens an inline creator (name + preset emoji) that adds a real, house-wide
 * category on the fly, so people don't have to leave the form to make one.
 */
export function CategoryPicker({
  houseId,
  categories,
  value,
  onChange,
}: {
  houseId: string;
  categories: PickerCat[];
  value: string;
  onChange: (code: string) => void;
}) {
  const supabase = createClient();
  const [cats, setCats] = useState<PickerCat[]>(categories);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(PRESET_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pick(code: string) {
    onChange(code);
    // Tapping "Other" reveals the make-your-own panel; any other chip hides it.
    setCreating(code === "other");
  }

  async function create() {
    const nm = name.trim();
    if (!nm) return;
    setBusy(true);
    setError(null);
    const code = `c_${Math.random().toString(36).slice(2, 9)}`;
    const color = PALETTE[cats.length % PALETTE.length];
    const { data, error: insErr } = await supabase
      .from("house_categories")
      .insert({ house_id: houseId, code, name: nm, emoji, color, sort: cats.length + 1 })
      .select("code,name,emoji,color")
      .single();
    if (insErr || !data) {
      setError("Couldn't add that — please try again.");
      setBusy(false);
      return;
    }
    setCats((cs) => [...cs, data as PickerCat]);
    onChange((data as PickerCat).code);
    setCreating(false);
    setName("");
    setEmoji(PRESET_EMOJIS[0]);
    setBusy(false);
  }

  return (
    <div>
      <span className="label">Category</span>
      <div className="flex flex-wrap gap-2">
        {cats.map((c) => (
          <button
            key={c.code}
            type="button"
            onClick={() => pick(c.code)}
            className={`chip border ${
              value === c.code
                ? "border-brand-500 bg-brand-50 text-brand-700"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            <span>{c.emoji}</span>
            {c.name}
          </button>
        ))}
      </div>

      {creating && (
        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-medium text-slate-600">
            Make your own — name it and pick an icon, or just leave it as Other.
          </p>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-xl">
              {emoji}
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void create();
                }
              }}
              placeholder="e.g. Taxi, Gym, Pet food"
              maxLength={30}
              className="input min-w-0 flex-1"
              aria-label="New category name"
            />
          </div>
          <div className="mt-2 grid grid-cols-8 gap-1">
            {PRESET_EMOJIS.map((em) => (
              <button
                key={em}
                type="button"
                onClick={() => setEmoji(em)}
                aria-label={`Use ${em}`}
                className={`grid h-8 place-items-center rounded-lg text-lg transition ${
                  emoji === em
                    ? "bg-brand-100 ring-1 ring-brand-400"
                    : "hover:bg-slate-100 dark:hover:bg-white/[0.06]"
                }`}
              >
                {em}
              </button>
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="button"
            onClick={() => void create()}
            disabled={busy || !name.trim()}
            className="btn-primary btn-block mt-3 py-2 text-sm"
          >
            {busy ? "Adding…" : "Create category"}
          </button>
        </div>
      )}
    </div>
  );
}
