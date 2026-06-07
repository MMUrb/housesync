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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That image is too large (max 5 MB).");
      return;
    }
    setError(null);
    setUploading(true);
    try {
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (updErr) throw updErr;
      setAvatarUrl(url);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto() {
    setError(null);
    setAvatarUrl(null);
    await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
    router.refresh();
  }

  async function choosePreset(url: string) {
    setError(null);
    setAvatarUrl(url);
    await supabase.from("profiles").update({ avatar_url: url }).eq("id", userId);
    router.refresh();
  }

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
      {/* Profile photo */}
      <div className="flex items-center gap-4">
        <Avatar name={name} color={color} avatarUrl={avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <span className="label">Profile photo</span>
          <div className="flex flex-wrap gap-2">
            <label
              className={`btn-secondary cursor-pointer px-3 py-1.5 text-xs ${
                uploading ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {uploading ? "Uploading…" : avatarUrl ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onFile}
                disabled={uploading}
              />
            </label>
            {avatarUrl && (
              <button
                type="button"
                onClick={removePhoto}
                className="btn-secondary px-3 py-1.5 text-xs"
              >
                Remove
              </button>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-400">JPG or PNG, up to 5 MB.</p>
        </div>
      </div>

      {/* Or pick a ready-made cartoon avatar */}
      <div>
        <span className="label">Or pick an avatar</span>
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
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

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

      {/* Colour — used as a fallback when there's no photo */}
      <div>
        <span className="label">
          Your colour{" "}
          {avatarUrl && <span className="font-normal text-slate-400">(used when no photo)</span>}
        </span>
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
