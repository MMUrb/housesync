"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_COLORS } from "@/lib/constants";
import { Avatar } from "@/components/Avatar";

const PRESET_AVATARS = Array.from({ length: 10 }, (_, i) => `/avatars/preset-${i + 1}.svg`);

export function ProfileForm({
  userId,
  initialName,
  initialColor,
  initialAvatarUrl,
}: {
  userId: string;
  initialName: string;
  initialColor: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function choosePreset(url: string) {
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    router.refresh();
  }

  // Clear the avatar back to the coloured initials.
  async function useInitials() {
    setAvatarUrl(null);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    router.refresh();
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        avatar_color: color,
      })
      .eq("id", userId);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="card space-y-4 p-5">
      {/* Avatar preview + ready-made choices */}
      <div className="flex items-center gap-4">
        <Avatar name={name} color={color} avatarUrl={avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <span className="label">Your avatar</span>
          <p className="text-xs text-slate-400">Pick one of the ready-made avatars below.</p>
        </div>
      </div>

      <div>
        <div className="flex flex-wrap gap-2">
          {PRESET_AVATARS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => choosePreset(p)}
              aria-label="Choose this avatar"
              className={`overflow-hidden rounded-full ring-offset-2 transition ${
                avatarUrl === p ? "ring-2 ring-brand-600" : "hover:opacity-80"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p} alt="" className="h-12 w-12" />
            </button>
          ))}
          {/* Use your coloured initials instead of a ready-made avatar. */}
          <button
            type="button"
            onClick={useInitials}
            aria-label="Use your initials"
            className={`grid h-12 w-12 place-items-center rounded-full font-semibold text-white ring-offset-2 transition ${
              avatarUrl === null ? "ring-2 ring-brand-600" : "hover:opacity-80"
            }`}
            style={{ backgroundColor: color }}
            title="Use your initials"
          >
            {(name.trim()[0] || "?").toUpperCase()}
          </button>
        </div>
      </div>

      {/* Name */}
      <div>
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

      {/* Colour — used for the initials avatar. */}
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
