"use client";

import { Fragment, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { emitChatRead } from "@/lib/chatRead";
import { reportClientError } from "@/components/ErrorReporter";
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
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  // Times are formatted in the viewer's locale/timezone, which the server can't
  // know — rendering them during SSR caused a hydration mismatch (React #418).
  // Gate them on mount so the server and first client paint render the same
  // placeholder, then fill in the real local time once we're on the client.
  const [mounted, setMounted] = useState(false);

  const endRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const emojiBtnRef = useRef<HTMLButtonElement | null>(null);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

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

  // Keep the latest message in view. The FIRST scroll (opening the chat) jumps
  // instantly so you land on the newest messages, not a scrolling animation;
  // only messages arriving while you watch scroll smoothly. Prepending older
  // history must NOT yank you back to the bottom — loadOlder sets the skip.
  const hasScrolled = useRef(false);
  const skipNextAutoScroll = useRef(false);
  useEffect(() => {
    if (skipNextAutoScroll.current) {
      skipNextAutoScroll.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: hasScrolled.current ? "smooth" : "auto" });
    hasScrolled.current = true;
  }, [messages]);

  // Load older history when you scroll to the top (the server sends only the
  // newest 100). Scroll position is preserved across the prepend.
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(initialMessages.length >= 100);
  const loadingOlderRef = useRef(false);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  async function loadOlder() {
    const el = scrollerRef.current;
    const oldest = messages[0]?.created_at;
    if (!el || !oldest || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("house_id", houseId)
        .lt("created_at", oldest)
        .order("created_at", { ascending: false })
        .limit(50);
      const older = ((data as Message[] | null) ?? []).reverse();
      setHasMore(older.length === 50);
      if (older.length > 0) {
        const prevHeight = el.scrollHeight;
        skipNextAutoScroll.current = true;
        setMessages((prev) => {
          const byId = new Map(older.map((m) => [m.id, m] as const));
          for (const m of prev) byId.set(m.id, m);
          return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
        });
        // Keep the same messages on screen once the new ones are above them.
        requestAnimationFrame(() => {
          el.scrollTop += el.scrollHeight - prevHeight;
        });
      }
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  }

  useEffect(() => {
    const el = topSentinelRef.current;
    const root = scrollerRef.current;
    if (!el || !root || !hasMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadOlder();
      },
      { root, rootMargin: "80px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, messages.length]);

  // WhatsApp behaviour for the keyboard: when it opens (or closes) the chat
  // box resizes — if you were reading the newest messages, stay pinned to
  // them instead of leaving them hidden behind the keyboard. Scrolled up
  // reading history? We leave your position alone.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(true);
  function trackScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    nearBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
  }
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => {
      if (!nearBottomRef.current) return;
      // Two frames so the layout has settled at the new viewport size.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          endRef.current?.scrollIntoView({ behavior: "auto" });
        });
      });
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Catch up after the app was backgrounded: realtime events are missed while
  // the webview is suspended, so refetch the tail when we become visible again.
  useEffect(() => {
    async function catchUp() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("house_id", houseId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (!data) return;
      const fresh = (data as Message[]).reverse();
      setMessages((prev) => {
        const byId = new Map(prev.map((m) => [m.id, m]));
        for (const m of fresh) byId.set(m.id, m);
        return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
      });
    }
    function onVisible() {
      if (document.visibilityState === "visible") void catchUp();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Mark the chat read server-side whenever it's open and as new messages
  // arrive while viewing. Stored per (user, house), so the unread badge clears
  // on this account's other devices/platforms too. We mark read up to the
  // newest loaded message's own server timestamp (not the device clock) — using
  // Date.now() let clock skew leave already-read messages counted as unread.
  useEffect(() => {
    const lastReadAt = messages.length
      ? messages[messages.length - 1].created_at
      : new Date().toISOString();
    // supabase-js queries are lazy: they only execute when awaited or .then()'d.
    // A bare `void query` builds the request but never sends it — which is why
    // read state was never saved and the unread badge came back on every
    // reload. The .then() actually fires it; failures go to the error log.
    void supabase
      .from("message_reads")
      .upsert(
        { user_id: currentUserId, house_id: houseId, last_read_at: lastReadAt },
        { onConflict: "user_id,house_id" },
      )
      .then(({ error }) => {
        if (error) {
          reportClientError(`Chat mark-read failed: ${error.message}`, { url: "/chat" });
        }
      });
    // Clear this house's badge in the switcher right away (don't wait for the
    // next server render of the layout).
    emitChatRead(houseId);
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

  function startReply(m: Message) {
    setReplyingTo(m);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setShowEmoji(false);

    // Optimistic: the message appears in the thread THE MOMENT you hit send
    // (slightly faded), like any messaging app. The insert result replaces it;
    // a failure removes it and puts your text back.
    const replyTarget = replyingTo;
    const replyTo = replyingTo?.id ?? null;
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimistic = {
      id: tempId,
      house_id: houseId,
      user_id: currentUserId,
      body,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
    } as Message;
    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setReplyingTo(null);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ house_id: houseId, user_id: currentUserId, body, reply_to: replyTo })
        .select()
        .single();
      if (error) throw error;
      const real = data as Message;
      setMessages((prev) => {
        const withoutTemp = prev.filter((m) => m.id !== tempId);
        // The realtime echo may already have delivered the real row.
        return withoutTemp.some((m) => m.id === real.id) ? withoutTemp : [...withoutTemp, real];
      });
      // Notify the other housemates (best-effort; server decides who's opted in).
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ houseId, preview: body }),
      });
    } catch (err) {
      // Roll back: drop the optimistic bubble, restore the draft + reply target.
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(body);
      setReplyingTo(replyTarget);
      setError(err instanceof Error ? err.message : "Couldn't send. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div data-chat-shell className="flex h-[calc(100dvh-16rem)] flex-col">
      <div ref={scrollerRef} onScroll={trackScroll} className="flex-1 overflow-y-auto pb-2">
        {/* Pagination head: sentinel triggers loadOlder as it scrolls into view. */}
        {messages.length > 0 && (
          <div className="py-1 text-center">
            {hasMore ? (
              <div ref={topSentinelRef}>
                <span
                  className={`inline-block text-[11px] text-slate-400 ${loadingOlder ? "" : "opacity-0"}`}
                >
                  Loading earlier messages…
                </span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-300">Beginning of the conversation</span>
            )}
          </div>
        )}
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
            // Automatic notices ("Rahul changed the house currency to EUR")
            // read as centred grey text, not a speech bubble.
            if (m.kind === "system") {
              const who =
                m.user_id === currentUserId ? "You" : profileOf(m.user_id)?.name ?? "A housemate";
              return (
                <p
                  key={m.id}
                  className="my-3 px-6 text-center text-[11px] leading-relaxed text-slate-400"
                >
                  {who} {m.body}
                </p>
              );
            }
            const prev = messages[i - 1];
            const gap = prev
              ? new Date(m.created_at).getTime() - new Date(prev.created_at).getTime()
              : Infinity;
            const showSep = gap >= GROUP_GAP_MS;
            const startGroup = showSep || !prev || prev.user_id !== m.user_id;
            const prof = profileOf(m.user_id);
            const repliedTo = m.reply_to ? messages.find((x) => x.id === m.reply_to) : null;
            const quote = repliedTo
              ? {
                  name:
                    repliedTo.user_id === currentUserId
                      ? "You"
                      : profileOf(repliedTo.user_id)?.name ?? "Housemate",
                  body: repliedTo.body,
                }
              : m.reply_to
                ? // Parent is above the loaded window — say so instead of
                  // silently dropping the quote.
                  { name: "Reply", body: "Earlier message — scroll up to load it" }
                : null;
            return (
              <Fragment key={m.id}>
                {showSep && (
                  <div className="my-3 text-center">
                    <span
                      className="text-[11px] font-medium text-slate-400"
                      suppressHydrationWarning
                    >
                      {mounted ? formatSeparator(m.created_at) : " "}
                    </span>
                  </div>
                )}
                <div className={m.id.startsWith("temp-") ? "opacity-60" : undefined}>
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
                    quote={quote}
                    onReply={() => startReply(m)}
                  />
                </div>
              </Fragment>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 pt-3">
        {replyingTo && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 dark:bg-white/[0.06]">
            <div className="min-w-0 flex-1 border-l-2 border-brand-400 pl-2">
              <p className="text-xs font-semibold text-slate-600">
                Replying to{" "}
                {replyingTo.user_id === currentUserId
                  ? "yourself"
                  : profileOf(replyingTo.user_id)?.name ?? "Housemate"}
              </p>
              <p className="truncate text-xs text-slate-500">{replyingTo.body}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              aria-label="Cancel reply"
              className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.1]"
            >
              ✕
            </button>
          </div>
        )}
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
  quote,
  onReply,
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
  quote?: { name: string; body: string } | null;
  onReply?: () => void;
}) {
  // Swipe a message to the right to reply (iMessage/WhatsApp style). We move the
  // row imperatively during the drag to avoid re-rendering, and only lock onto
  // the horizontal axis once it clearly dominates so vertical scrolling still
  // works. Past the threshold on release, fire the reply.
  const slideRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLSpanElement>(null);
  const start = useRef({ x: 0, y: 0 });
  const axis = useRef<"h" | "v" | null>(null);
  const dx = useRef(0);

  function onTouchStart(e: ReactTouchEvent<HTMLDivElement>) {
    start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    axis.current = null;
    dx.current = 0;
  }
  function onTouchMove(e: ReactTouchEvent<HTMLDivElement>) {
    const mx = e.touches[0].clientX - start.current.x;
    const my = e.touches[0].clientY - start.current.y;
    if (axis.current === null && (Math.abs(mx) > 8 || Math.abs(my) > 8)) {
      axis.current = Math.abs(mx) > Math.abs(my) ? "h" : "v";
    }
    if (axis.current !== "h") return;
    const d = Math.max(0, Math.min(mx, 88));
    dx.current = d;
    if (slideRef.current) slideRef.current.style.transform = `translateX(${d}px)`;
    if (iconRef.current) iconRef.current.style.opacity = String(Math.min(d / 52, 1));
  }
  function onTouchEnd() {
    const trigger = dx.current > 50;
    const el = slideRef.current;
    if (el) {
      el.style.transition = "transform 0.16s ease-out";
      el.style.transform = "translateX(0)";
      window.setTimeout(() => (el.style.transition = ""), 180);
    }
    if (iconRef.current) iconRef.current.style.opacity = "0";
    dx.current = 0;
    axis.current = null;
    if (trigger) onReply?.();
  }

  return (
    <div className="relative">
      <span
        ref={iconRef}
        aria-hidden="true"
        className="pointer-events-none absolute left-1 top-1/2 -translate-y-1/2 text-brand-500 opacity-0"
      >
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 5 4 10l5 5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4.5 10H12a4 4 0 0 1 4 4v1" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>

      <div
        ref={slideRef}
        onTouchStart={onReply ? onTouchStart : undefined}
        onTouchMove={onReply ? onTouchMove : undefined}
        onTouchEnd={onReply ? onTouchEnd : undefined}
        className={`mt-1 flex touch-pan-y gap-2 ${mine ? "justify-end" : "justify-start"}`}
      >
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
            {quote && (
              <span className={`mb-1 block border-l-2 pl-2 ${mine ? "border-white/50" : "border-brand-400"}`}>
                <span className={`block text-[11px] font-semibold ${mine ? "text-white/90" : "text-brand-700"}`}>
                  {quote.name}
                </span>
                <span className={`block truncate text-xs ${mine ? "text-white/75" : "text-slate-500"}`}>
                  {quote.body}
                </span>
              </span>
            )}
            <span className="whitespace-pre-wrap break-words">{body}</span>
          </button>
          {revealed && (
            <span className="mt-0.5 flex items-center gap-2 px-1 text-[10px] text-slate-400">
              {time}
              {onReply && (
                <button
                  type="button"
                  onClick={onReply}
                  className="font-medium text-brand-500 hover:underline"
                >
                  Reply
                </button>
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
