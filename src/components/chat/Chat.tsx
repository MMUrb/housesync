"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { EmojiPicker } from "@/components/chat/EmojiPicker";
import type { MemberWithProfile, Message } from "@/lib/types";

// Show a centred time separator when messages are this far apart (like iMessage).
const GROUP_GAP_MS = 5 * 60 * 1000;

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSeparator(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const time = formatTime(iso);
  if (d.toDateString() === now.toDateString()) return time;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday ${time}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })} · ${time}`;
}

export function Chat({
  houseId,
  currentUserId,
  initialMessages,
  members,
}: {
  houseId: string;
  currentUserId: string;
  initialMessages: Message[];
  members: MemberWithProfile[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  const profileOf = (userId: string) =>
    members.find((m) => m.user_id === userId)?.profile ?? null;

  function addMessage(m: Message) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  // Stream new messages for this house live.
  useEffect(() => {
    const channel = supabase
      .channel(`house-chat:${houseId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `house_id=eq.${houseId}`,
        },
        (payload) => addMessage(payload.new as Message),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Keep the latest message in view.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark the chat read server-side whenever it's open and as new messages
  // arrive while viewing. Stored per (user, house), so the unread dot clears
  // on this account's other devices/platforms too.
  useEffect(() => {
    void supabase.from("message_reads").upsert(
      { user_id: currentUserId, house_id: houseId, last_read_at: new Date().toISOString() },
      { onConflict: "user_id,house_id" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, currentUserId, messages.length]);

  // Close the emoji picker when tapping elsewhere.
  useEffect(() => {
    if (!showEmoji) return;
    function onDown(e: PointerEvent) {
      const t = e.target as Node;
      if (emojiBtnRef.current?.contains(t) || pickerRef.current?.contains(t)) return;
      setShowEmoji(false);
    }
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [showEmoji]);

  function insertEmoji(emoji: string) {
    const ta = textareaRef.current;
    if (!ta) {
      setText((t) => t + emoji);
      return;
    }
    const start = ta.selectionStart ?? text.length;
    const end = ta.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => {
      ta.focus();
      const pos = start + emoji.length;
      ta.setSelectionRange(pos, pos);
    });
  }

  function toggleReveal(id: string) {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setShowEmoji(false);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ house_id: houseId, user_id: currentUserId, body })
        .select()
        .single();
      if (error) throw error;
      if (data) addMessage(data as Message);
      setText("");
      // Notify the other housemates (best-effort; server decides who's opted in).
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ houseId, preview: body }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-16rem)] flex-col">
      <div className="flex-1 overflow-y-auto pb-2">
        {messages.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-slate-400">
            <div>
              <p className="text-3xl">👋</p>
              <p className="mt-2">No messages yet.</p>
              <p>Say hello to the house!</p>
            </div>
          </div>
        ) : (
          messages.map((m, i) => {
            const prev = messages[i - 1];
            const gap = prev
              ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()
              : Infinity;
            const showSep = gap >= GROUP_GAP_MS;
            const startGroup = showSep || !prev || prev.user_id !== m.user_id;
            const prof = profileOf(m.user_id);
            return (
              <Fragment key={m.id}>
                {showSep && (
                  <div className="my-3 text-center">
                    <span className="text-[11px] font-medium text-slate-400">
                      {formatSeparator(m.created_at)}
                    </span>
                  </div>
                )}
                <Bubble
                  mine={m.user_id === currentUserId}
                  name={prof?.name ?? "Housemate"}
                  color={prof?.avatar_color ?? "#6f53f5"}
                  avatarUrl={prof?.avatar_url ?? null}
                  body={m.body}
                  time={formatTime(m.created_at)}
                  startGroup={startGroup}
                  revealed={revealed.has(m.id)}
                  onTap={() => toggleReveal(m.id)}
                />
              </Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="relative flex items-end gap-2">
          {showEmoji && (
            <div ref={pickerRef}>
              <EmojiPicker onPick={insertEmoji} />
            </div>
          )}
          <button
            ref={emojiBtnRef}
            type="button"
            aria-label="Add emoji"
            onClick={() => setShowEmoji((v) => !v)}
            className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-2xl text-slate-500 transition hover:bg-slate-100"
          >
            🙂
          </button>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="Message the house…"
            className="input max-h-32 flex-1 resize-none py-2.5"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={sending || !text.trim()}
            className="btn-primary shrink-0 px-5 py-2.5"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
        {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}

function Bubble({
  mine,
  name,
  color,
  avatarUrl,
  body,
  time,
  startGroup,
  revealed,
  onTap,
}: {
  mine: boolean;
  name: string;
  color: string;
  avatarUrl: string | null;
  body: string;
  time: string;
  startGroup: boolean;
  revealed: boolean;
  onTap: () => void;
}) {
  return (
    <div className={`mt-1 flex gap-2 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine && (
        <div className="w-7 shrink-0 self-end">
          {startGroup && <Avatar name={name} color={color} avatarUrl={avatarUrl} size="sm" />}
        </div>
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!mine && startGroup && (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-slate-500">{name}</span>
        )}
        <button
          type="button"
          onClick={onTap}
          className={`max-w-full rounded-2xl px-3.5 py-2 text-left text-sm leading-snug ${
            mine
              ? "rounded-br-md bg-brand-600 text-white"
              : "rounded-bl-md bg-slate-100 text-slate-900"
          }`}
        >
          <span className="whitespace-pre-wrap break-words">{body}</span>
        </button>
        {revealed && <span className="mt-0.5 px-1 text-[10px] text-slate-400">{time}</span>}
      </div>
    </div>
  );
}
