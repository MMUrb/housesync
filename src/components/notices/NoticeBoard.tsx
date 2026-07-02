"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/format";
import type { MemberWithProfile, Notice } from "@/lib/types";

const TITLE_MAX = 120;
const MESSAGE_MAX = 1000;

// Pinned first, then newest first — mirrors getNotices() so client-side edits
// keep the same order without a refetch.
function sortNotices(list: Notice[]): Notice[] {
  return [...list].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return a.created_at < b.created_at ? 1 : -1;
  });
}

export function NoticeBoard({
  houseId,
  currentUserId,
  initialNotices,
  members,
}: {
  houseId: string;
  currentUserId: string;
  initialNotices: Notice[];
  members: MemberWithProfile[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [notices, setNotices] = useState<Notice[]>(() => sortNotices(initialNotices));
  // Re-sync when the server sends a fresh snapshot (router.refresh() after any
  // mutation, or a housemate's live change via HouseRealtime). Server is truth;
  // optimistic edits below are reconciled by the refresh they trigger.
  useEffect(() => {
    setNotices(sortNotices(initialNotices));
  }, [initialNotices]);

  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameOf = (userId: string | null) =>
    (userId && members.find((m) => m.user_id === userId)?.profile?.name) || "A housemate";

  async function addNotice(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data, error: insErr } = await supabase
        .from("notices")
        .insert({
          house_id: houseId,
          title: t.slice(0, TITLE_MAX),
          message: message.trim().slice(0, MESSAGE_MAX) || null,
          posted_by: currentUserId,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      if (data) setNotices((prev) => sortNotices([data as Notice, ...prev]));
      // Log to the house timeline (best-effort), same as other actions.
      void supabase.from("activity").insert({
        house_id: houseId,
        user_id: currentUserId,
        type: "notice_posted",
        message: `posted a notice: “${t.slice(0, 60)}”`,
      });
      setTitle("");
      setMessage("");
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post that notice.");
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(n: Notice) {
    const next = !n.pinned;
    setNotices((prev) => sortNotices(prev.map((x) => (x.id === n.id ? { ...x, pinned: next } : x))));
    const { error: upErr } = await supabase
      .from("notices")
      .update({ pinned: next })
      .eq("id", n.id);
    if (upErr) {
      // Roll back on failure.
      setNotices((prev) =>
        sortNotices(prev.map((x) => (x.id === n.id ? { ...x, pinned: n.pinned } : x))),
      );
    }
  }

  async function remove(n: Notice) {
    const prev = notices;
    setNotices((list) => list.filter((x) => x.id !== n.id));
    const { error: delErr } = await supabase.from("notices").delete().eq("id", n.id);
    if (delErr) setNotices(prev); // restore on failure
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold text-slate-900">📌 Noticeboard</h2>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs font-medium text-brand-600 hover:underline"
        >
          {open ? "Cancel" : "Add notice"}
        </button>
      </div>

      {open && (
        <form onSubmit={addNotice} className="card space-y-3 p-4">
          <input
            className="input"
            placeholder="Notice title (e.g. Bin day moved to Thursday)"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
            required
          />
          <textarea
            className="input max-h-40 resize-none"
            rows={2}
            placeholder="Add more detail (optional)"
            value={message}
            maxLength={MESSAGE_MAX}
            onChange={(e) => setMessage(e.target.value)}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button type="submit" disabled={busy || !title.trim()} className="btn-primary btn-block">
            {busy ? "Posting…" : "Post notice"}
          </button>
        </form>
      )}

      {notices.length === 0 ? (
        <div className="card flex items-center gap-3 p-4 text-sm text-slate-500">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-400">
            📋
          </span>
          No notices yet. Post one to share news with the house.
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {notices.map((n) => (
            <li key={n.id} className="p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                    {n.pinned && <span aria-label="Pinned">📌</span>}
                    <span className="min-w-0 break-words">{n.title}</span>
                  </p>
                  {n.message && (
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-slate-600">
                      {n.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-400">
                    {nameOf(n.posted_by)} · {timeAgo(n.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => togglePin(n)}
                    aria-label={n.pinned ? "Unpin notice" : "Pin notice"}
                    className={`rounded-lg px-2 py-1 text-xs font-medium transition-colors hover:bg-slate-100 ${
                      n.pinned ? "text-brand-600" : "text-slate-400"
                    }`}
                  >
                    {n.pinned ? "Unpin" : "Pin"}
                  </button>
                  {n.posted_by === currentUserId && (
                    <button
                      type="button"
                      onClick={() => remove(n)}
                      aria-label="Delete notice"
                      className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
