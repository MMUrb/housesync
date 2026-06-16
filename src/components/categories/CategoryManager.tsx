"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Cat = { id: string; code: string; name: string; emoji: string; color: string; sort: number };

const PALETTE = [
  "#6f53f5",
  "#3f9fe0",
  "#1bb27e",
  "#e0567f",
  "#e0b53f",
  "#9b5fe0",
  "#ef4444",
  "#94a3b8",
];

export function CategoryManager({ houseId, initial }: { houseId: string; initial: Cat[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>(initial);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📦");
  const [color, setColor] = useState(PALETTE[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setLocal = (id: string, p: Partial<Cat>) =>
    setCats((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  async function persist(id: string, p: Partial<Cat>) {
    setLocal(id, p);
    await supabase.from("house_categories").update(p).eq("id", id);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const nm = name.trim();
    if (!nm) return;
    setBusy(true);
    setError(null);
    const code = `c_${Math.random().toString(36).slice(2, 9)}`;
    const sort = Math.max(0, ...cats.map((c) => c.sort)) + 1;
    const { data, error: insErr } = await supabase
      .from("house_categories")
      .insert({ house_id: houseId, code, name: nm, emoji: emoji.trim() || "📦", color, sort })
      .select()
      .single();
    if (insErr || !data) {
      setError("Couldn't add that — please try again.");
      setBusy(false);
      return;
    }
    setCats((cs) => [...cs, data as Cat]);
    setName("");
    setEmoji("📦");
    setColor(PALETTE[0]);
    setBusy(false);
    router.refresh();
  }

  async function remove(id: string) {
    setCats((cs) => cs.filter((c) => c.id !== id));
    await supabase.from("house_categories").update({ archived: true }).eq("id", id);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="card divide-y divide-slate-100 p-0">
        {cats.map((c) => (
          <div key={c.id} className="flex items-center gap-2 p-3">
            <input
              value={c.emoji}
              maxLength={4}
              onChange={(e) => setLocal(c.id, { emoji: e.target.value })}
              onBlur={(e) => persist(c.id, { emoji: e.target.value.trim() || "📦" })}
              className="input w-12 px-0 text-center"
              aria-label="Emoji"
            />
            <input
              value={c.name}
              onChange={(e) => setLocal(c.id, { name: e.target.value })}
              onBlur={(e) => e.target.value.trim() && persist(c.id, { name: e.target.value.trim() })}
              className="input min-w-0 flex-1"
              aria-label="Category name"
            />
            <div className="hidden gap-1 sm:flex">
              {PALETTE.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={`Colour ${p}`}
                  onClick={() => persist(c.id, { color: p })}
                  className={`h-5 w-5 rounded-full transition ${
                    c.color === p ? "ring-2 ring-slate-400 ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: p }}
                />
              ))}
            </div>
            <span className="h-5 w-5 shrink-0 rounded-full sm:hidden" style={{ backgroundColor: c.color }} />
            <button
              type="button"
              onClick={() => remove(c.id)}
              aria-label="Remove category"
              className="shrink-0 px-1.5 text-lg leading-none text-slate-300 transition hover:text-red-500"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <form onSubmit={add} className="card space-y-3 p-4">
        <p className="text-sm font-medium text-slate-800">Add a category</p>
        <div className="flex items-center gap-2">
          <input
            value={emoji}
            maxLength={4}
            onChange={(e) => setEmoji(e.target.value)}
            className="input w-12 px-0 text-center"
            aria-label="Emoji"
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Streaming services"
            className="input min-w-0 flex-1"
            aria-label="New category name"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {PALETTE.map((p) => (
            <button
              key={p}
              type="button"
              aria-label={`Colour ${p}`}
              onClick={() => setColor(p)}
              className={`h-6 w-6 rounded-full transition ${
                color === p ? "ring-2 ring-slate-400 ring-offset-1" : ""
              }`}
              style={{ backgroundColor: p }}
            />
          ))}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={busy || !name.trim()} className="btn-primary btn-block">
          {busy ? "Adding…" : "Add category"}
        </button>
      </form>

      <p className="px-1 text-xs text-slate-400">
        Removing a category hides it from new expenses. Anything already filed under it keeps its
        history.
      </p>
    </div>
  );
}
