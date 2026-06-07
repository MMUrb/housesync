"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_COLORS } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";

export function ProfileForm({
  userId,
  initialName,
  initialColor,
}: {
  userId: string;
  initialName: string;
  initialColor: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase.from("profiles").update({ name: name.trim(), avatar_color: color }).eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      <div className="flex items-center gap-3">
        <Avatar name={name} color={color} size="lg" />
        <div className="min-w-0 flex-1">
          <label className="label" htmlFor="profile-name">
            Your name
          </label>
          <input
            id="profile-name"
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </div>

      <div>
        <span className="label">Your colour</span>
        <div className="flex flex-wrap gap-2">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              aria-label={`Choose colour ${c}`}
              className={`h-8 w-8 rounded-full ring-offset-2 transition ${
                color === c ? "ring-2 ring-slate-800" : ""
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving…" : saved ? "Saved!" : "Save profile"}
      </button>
    </form>
  );
}
