"use client";

import { Fragment, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { uniqueTopic } from "@/lib/realtimeTopic";
import { emitChatRead } from "@/lib/chatRead";
import { reportClientError, isNetworkError } from "@/components/ErrorReporter";
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
  initialLoadFailed = false,
  openAtId = null,
  initialHasMore,
  initialHasNewer = false,
  members,
}: {
  houseId: string;
  currentUserId: string;
  initialMessages: Message[];
  /** The server read failed, so an empty list means unknown, not empty. */
  initialLoadFailed?: boolean;
  /** Open the thread at this message (from search) instead of at the newest. */
  openAtId?: string | null;
  /** Whether history exists beyond each edge of a search-opened window. */
  initialHasMore?: boolean;
  initialHasNewer?: boolean;
  members: MemberWithProfile[];
}) {
  const supabase = createClient();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  // Mirror of the draft: a failed-send restore has to know whether the user
  // typed while the request was in flight, and a functional updater runs too
  // late to decide with.
  const textRef = useRef("");
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
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  const profileOf = (userId: string) =>
    members.find((m) => m.user_id === userId)?.profile ?? null;

  function addMessage(m: Message) {
    // A reader who has scrolled up (or opened the thread at an old message)
    // must not be yanked to the bottom by someone else's new message. Arm
    // the skip only when a row will really be added: a duplicate delivery
    // causes no render, and an armed flag would then swallow the next one.
    if (!nearBottomRef.current && !messagesRef.current.some((x) => x.id === m.id)) {
      skipNextAutoScroll.current = true;
    }
    setMessages((prev) =>
      prev.some((x) => x.id === m.id)
        ? prev
        : [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }

  // Search can open the thread at an old message. While newer history exists
  // beyond the loaded window, live inserts are held back (appending them
  // would stitch a hole into the thread); "Jump to latest" or the visibility
  // catch-up fills the gap and clears the flag.
  const [hasNewer, setHasNewer] = useState(Boolean(openAtId) && initialHasNewer);
  const hasNewerRef = useRef(hasNewer);
  useEffect(() => {
    hasNewerRef.current = hasNewer;
  }, [hasNewer]);
  const [highlightId, setHighlightId] = useState<string | null>(openAtId);
  // Cleared by the first catch-up that actually returns, which the mount
  // effect below starts immediately.
  const [loadFailed, setLoadFailed] = useState(initialLoadFailed);
  // Sends that failed, keyed by the optimistic row's temp id. The bubble
  // stays in the thread rather than vanishing, so nothing you wrote is lost,
  // and the retry reuses the SAME row id: a message that actually landed can
  // never be posted twice.
  const [failedSends, setFailedSends] = useState<
    Map<string, { rowId: string | null; body: string; replyTo: string | null }>
  >(new Map());
  useEffect(() => {
    if (initialLoadFailed) setLoadFailed(true);
  }, [initialLoadFailed]);

  /** Replace the loaded window with the newest 100. False when nothing could be fetched. */
  async function jumpToLatest(): Promise<boolean> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("house_id", houseId)
      .order("created_at", { ascending: false })
      .limit(100);
    const rows = ((data as Message[] | null) ?? []).reverse();
    if (error || rows.length === 0) return false; // nothing to jump to; keep the window as is
    windowGen.current++;
    setHasNewer(false);
    nearBottomRef.current = true;
    setAtBottom(true);
    applyServerBatch(rows);
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "auto" }));
    return true;
  }

  // Mirror of `messages` for use inside callbacks that must not re-subscribe
  // whenever the list changes (the catch-up refetch).
  const messagesRef = useRef<Message[]>(initialMessages);
  // Bumped whenever the loaded window is REPLACED (not merged). Async work
  // started against the old window checks it before touching state.
  const windowGen = useRef(0);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  /**
   * Fold a batch of server rows into the thread. Every server-side path
   * (catch-up, prop refresh) goes through here so they can't drift apart.
   *
   *  - Bails when the batch adds nothing, so it never causes a pointless
   *    re-render or leaves the skip-scroll flag armed for a later update.
   *  - Keeps in-flight optimistic bubbles.
   *  - If the batch starts AFTER everything we hold, the two windows don't
   *    touch. Union-merging would stitch a permanent hole into the thread,
   *    and loadOlder could never fill it (it only pages below the array
   *    head) — so replace the window instead of faking continuity.
   *  - Never drags a reader who has scrolled up back down to the newest.
   */
  function applyServerBatch(fresh: Message[], opts?: { contiguous?: boolean }) {
    if (fresh.length === 0) return;
    const prev = messagesRef.current;
    const heldIds = new Set(prev.map((m) => m.id));
    if (fresh.every((m) => heldIds.has(m.id))) return;

    // Real rows only: optimistic ones carry the device clock, not server time.
    const held = prev.filter((m) => !m.id.startsWith("temp-"));
    const newestHeld = held.reduce<string | null>(
      (acc, m) => (!acc || m.created_at > acc ? m.created_at : acc),
      null,
    );
    const oldestFresh = fresh.reduce(
      (acc, m) => (m.created_at < acc ? m.created_at : acc),
      fresh[0].created_at,
    );
    // Contiguity is an INPUT, not something to infer: forward paging queries
    // `.gt(newestHeld)`, so "oldest fetched is newer than everything held" is
    // trivially true for it and would replace the thread on every catch-up.
    // Only a caller that may hand over an unrelated window (a fresh snapshot)
    // can trigger the replace.
    const disjoint =
      !opts?.contiguous && newestHeld !== null && oldestFresh > newestHeld;

    if (!nearBottomRef.current) skipNextAutoScroll.current = true;

    if (disjoint) {
      setHasMore(true);
      windowGen.current++;
      setMessages([...fresh, ...prev.filter((m) => m.id.startsWith("temp-"))]);
      return;
    }
    setMessages((p) => {
      const byId = new Map(p.map((m) => [m.id, m] as const));
      for (const m of fresh) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }

  // A fresh server snapshot arrived (pull-to-refresh, or any router.refresh()
  // from HouseRealtime) — without this the chat ignored it entirely, because
  // useState only ever reads initialMessages once.
  useEffect(() => {
    // Once the loaded window has been REPLACED (Jump to latest, or a long
    // catch-up), a refreshed snapshot from the server may be an unrelated
    // range: with ?m in the URL it is the original search window, which no
    // longer touches what we hold. Catch up forward from what we have
    // instead, which is contiguous by construction.
    if (windowGen.current > 0) {
      void catchUp();
      return;
    }
    applyServerBatch(initialMessages);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialMessages]);

  // Stream new messages for this house live. The topic is unique to this
  // mount (see uniqueTopic); the client reuses a still-leaving channel for a
  // repeated topic and subscribe() then never joins, which left the thread
  // silently dead after the live/search key swap or a quick tab round trip.
  useEffect(() => {
    const channel = supabase
      .channel(uniqueTopic(`house-chat:${houseId}`))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `house_id=eq.${houseId}`,
        },
        (payload) => {
          // Held back while the window is not at the live end, so the thread
          // cannot grow a hole. The nav counts it regardless, and the badge
          // is only cleared once this chat actually marks the thread read.
          if (hasNewerRef.current) return;
          addMessage(payload.new as Message);
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        // Catch up on EVERY join, the first included. The router serves a
        // cached copy of this screen for 30 seconds on a quick revisit, and a
        // send never updates that copy, so the first join heals a stale
        // snapshot and covers the gap between the server render and the
        // socket joining. Later joins are reconnects (network change, app
        // resume), where the visibility catch-up can run BEFORE the socket
        // has rejoined; this is the only hook that closes that window.
        if (!hasNewerRef.current) void catchUp();
      });
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
  const skipNextAutoScroll = useRef(Boolean(openAtId));
  useEffect(() => {
    if (skipNextAutoScroll.current) {
      skipNextAutoScroll.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: hasScrolled.current ? "smooth" : "auto" });
    hasScrolled.current = true;
  }, [messages]);

  // Opened at a message (from search): bring it into view and flash it.
  useEffect(() => {
    if (!openAtId) return;
    const el = document.getElementById(`msg-${openAtId}`);
    el?.scrollIntoView({ block: "center", behavior: "auto" });
    // A thread that fits on screen never fires onScroll, so settle the
    // at-bottom state from geometry once the target is in view.
    requestAnimationFrame(() => trackScroll());
    const t = setTimeout(() => setHighlightId(null), 2500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load older history when you scroll to the top (the server sends only the
  // newest 100). Scroll position is preserved across the prepend.
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore ?? initialMessages.length >= 100);
  const loadingOlderRef = useRef(false);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);

  async function loadOlder() {
    const el = scrollerRef.current;
    // Read the cursor from the live mirror, not the render closure: the
    // observer is only rebuilt on [hasMore, length], so a replaced window of
    // the same length would leave it paging from a discarded head.
    const oldest = messagesRef.current[0]?.created_at;
    if (!el || !oldest || loadingOlderRef.current) return;
    const gen = windowGen.current;
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
      // The window was replaced while this page was in flight: these rows
      // belong to the old head and would stitch a hole into the new one.
      if (gen !== windowGen.current) return;
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
    // messages[0]?.id in the deps so a same-length window swap still rebuilds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, messages.length, messages[0]?.id]);

  // WhatsApp behaviour for the keyboard: when it opens (or closes) the chat
  // box resizes — if you were reading the newest messages, stay pinned to
  // them instead of leaving them hidden behind the keyboard. Scrolled up
  // reading history? We leave your position alone.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const nearBottomRef = useRef(!openAtId);
  // atBottom mirrors nearBottomRef as state, so the mark-read effect re-runs
  // when the reader scrolls back down to the live end of the thread.
  const [atBottom, setAtBottom] = useState(!openAtId);
  function trackScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    nearBottomRef.current = near;
    setAtBottom((prev) => (prev === near ? prev : near));
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

  // Page FORWARD from the newest message we hold, rather than grabbing the
  // newest N. Fetching forward makes the result contiguous by construction,
  // so no hole can ever appear in the thread, and nothing already loaded
  // gets thrown away just because a lot arrived while we were away.
  // Fetch the newest window from scratch, used when there's no cursor to
  // page from, and as the tail of a very long catch-up.
  async function loadNewestWindow(): Promise<boolean> {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("house_id", houseId)
      .order("created_at", { ascending: false })
      .limit(100);
    // A request that never ran must not be mistaken for an empty house or
    // for having reached the live end.
    if (error) return false;
    applyServerBatch(((data as Message[] | null) ?? []).reverse());
    return true;
  }

  const catchingUp = useRef(false);
  const catchUpAgain = useRef(false);
  async function catchUp() {
    // Triggers coincide constantly on resume: the visibility tick starts a
    // fetch and the socket rejoins a second later. Dropping the later one
    // would lose exactly the messages that arrived while the channel was
    // down, so a trigger during a run is remembered and re-run once the
    // current one finishes. Bounded, so a burst cannot spin.
    if (catchingUp.current) {
      catchUpAgain.current = true;
      return;
    }
    catchingUp.current = true;
    try {
      let rounds = 0;
      do {
        catchUpAgain.current = false;
        await catchUpInner();
      } while (catchUpAgain.current && ++rounds < 3);
    } finally {
      catchingUp.current = false;
    }
  }

  async function catchUpInner() {
    const held = messagesRef.current.filter((m) => !m.id.startsWith("temp-"));
    // Nothing to page from (e.g. the chat was empty when we backgrounded),
    // grab the newest window instead of giving up, or messages posted while
    // away would never appear at all.
    if (held.length === 0) {
      if (await loadNewestWindow()) setLoadFailed(false);
      return;
    }
    let after = held.reduce((a, b) => (a.created_at > b.created_at ? a : b)).created_at;
    const collected: Message[] = [];

    for (let page = 0; page < 6; page++) {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("house_id", houseId)
        .gt("created_at", after)
        .order("created_at", { ascending: true })
        .limit(50);
      if (error) {
        // A request that never ran is not proof we are up to date. Taking
        // the live-end branch below would merge nothing, clear hasNewer and
        // report success. Keep whatever earlier pages returned and leave the
        // rest to the next trigger.
        if (collected.length > 0) applyServerBatch(collected, { contiguous: true });
        return;
      }
      const rows = (data as Message[] | null) ?? [];
      collected.push(...rows);
      if (rows.length < 50) {
        // Joins directly onto what we hold, so merge, never replace.
        applyServerBatch(collected, { contiguous: true });
        setHasNewer(false); // the window now reaches the live end
        setLoadFailed(false);
        return;
      }
      after = rows[rows.length - 1].created_at;
    }

    // 300+ behind. Keep what we already paid to fetch, then jump to the
    // newest window (which may legitimately not join up, hence no
    // contiguous flag).
    applyServerBatch(collected, { contiguous: true });
    if (await loadNewestWindow()) setHasNewer(false);
  }

  // Heal a stale screen on arrival, over plain HTTPS. The router serves a
  // cached copy of this page for 30 seconds, so a quick return after sending
  // renders a snapshot without that message. The socket cannot be relied on
  // to fix it: a blocked or half-open WebSocket means SUBSCRIBED never
  // arrives, and the message would sit missing until the poll. This runs
  // whenever sending works, because it uses the same transport.
  useEffect(() => {
    if (!hasNewerRef.current) void catchUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Catch up after the app was backgrounded: realtime events are missed while
  // the webview is suspended, so refetch the tail when we become visible again.
  // The same tail fetch runs when the network comes back and, while the
  // thread is on screen, once every 45 seconds: a subscription that has died
  // quietly (expired token, a socket that never rejoined) then costs under a
  // minute rather than a reopen. Normally it returns nothing.
  useEffect(() => {
    function tick() {
      if (document.visibilityState === "visible" && !hasNewerRef.current) void catchUp();
    }
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    const poll = setInterval(tick, 45_000);
    return () => {
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
      clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId]);

  // Mark the chat read server-side whenever it's open and as new messages
  // arrive while viewing. Stored per (user, house), so the unread badge clears
  // on this account's other devices/platforms too. We mark read up to the
  // newest loaded message's own server timestamp (not the device clock) — using
  // Date.now() let clock skew leave already-read messages counted as unread.
  // Only ever mark read up to a REAL server row. An optimistic bubble carries
  // the device clock, and because swapping in the real row leaves the array
  // length unchanged, a length-keyed effect would save that skewed time
  // permanently — hiding a housemate's next message from the unread badge.
  // MAX, not "last in the array": send() appends the confirmed row at the end,
  // so if a housemate's message arrived mid-send the tail is older than what's
  // above it. Taking the last element would move the read watermark BACKWARDS
  // and re-mark an already-read message as unread.
  const lastRealCreatedAt = messages.reduce<string | null>(
    (acc, m) =>
      m.id.startsWith("temp-") ? acc : !acc || m.created_at > acc ? m.created_at : acc,
    null,
  );

  // Messages that arrived while the reader was scrolled up. The thread
  // deliberately does not drag them down to new arrivals, so a pill says
  // they came. Derived from the newest message they had in view the last
  // time they were at the bottom, rather than counted, so it cannot drift.
  const seenUpTo = useRef<string | null>(lastRealCreatedAt);
  useEffect(() => {
    if (atBottom) seenUpTo.current = lastRealCreatedAt;
  }, [atBottom, lastRealCreatedAt]);
  const unseen = atBottom
    ? 0
    : messages.filter(
        (m) =>
          !m.id.startsWith("temp-") &&
          m.user_id !== currentUserId &&
          m.kind !== "system" &&
          seenUpTo.current !== null &&
          m.created_at > seenUpTo.current,
      ).length;

  useEffect(() => {
    // Only mark read what the reader could actually SEE. When they're scrolled
    // up in history we deliberately don't scroll them to new arrivals, so
    // advancing the watermark would bury those messages as "read" on every
    // device, permanently. The effect re-runs when they scroll back down.
    if (!atBottom || hasNewer) return; // a search window is not the live end
    const lastReadAt = lastRealCreatedAt ?? new Date().toISOString();
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
        // Network blips are routine here: iOS suspends the webview the moment
        // the app is backgrounded and kills the in-flight request. The effect
        // re-runs on the next message or reopen, so the watermark heals itself.
        // Only genuine failures (RLS, constraint) are worth the error log.
        if (error && !isNetworkError(error.message)) {
          reportClientError(`Chat mark-read failed: ${error.message}`, { url: "/chat" });
        }
      });
    // Clear this house's badge in the switcher right away (don't wait for the
    // next server render of the layout).
    emitChatRead(houseId);
    // Keyed on the real-row timestamp, not messages.length, so the watermark
    // updates when an optimistic bubble is swapped for its server row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [houseId, currentUserId, lastRealCreatedAt, atBottom, hasNewer]);

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
    // A still-sending message has a client-side temp id, not a uuid — using it
    // as reply_to makes the reply permanently unsendable.
    if (m.id.startsWith("temp-")) return;
    setReplyingTo(m);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  /** Put a confirmed server row in place of its optimistic bubble. */
  function swapInReal(tempId: string, real: Message) {
    setFailedSends((prev) => {
      if (!prev.has(tempId)) return prev;
      const next = new Map(prev);
      next.delete(tempId);
      return next;
    });
    setMessages((prev) => {
      const withoutTemp = prev.filter((m) => m.id !== tempId);
      // The realtime echo may already have delivered the real row. Sort on
      // insert: a housemate's message can land while ours is in flight, so
      // appending blindly would leave the thread out of order.
      return withoutTemp.some((m) => m.id === real.id)
        ? withoutTemp
        : [...withoutTemp, real].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }

  /**
   * Write one already-optimistic message. The first attempt and every retry
   * go through here with the same row id, so a retry after a lost response
   * cannot produce a duplicate.
   */
  async function deliver(
    tempId: string,
    rowId: string | null,
    body: string,
    replyTo: string | null,
  ): Promise<void> {
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          ...(rowId ? { id: rowId } : {}),
          house_id: houseId,
          user_id: currentUserId,
          body,
          reply_to: replyTo,
        })
        .select()
        .single();
      if (error) throw error;
      swapInReal(tempId, data as Message);
      // Notify the other housemates (best-effort; server decides who's opted in).
      void fetch("/api/push/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ houseId, preview: body }),
      });
    } catch {
      // A dropped response doesn't mean the write failed. A retry reusing the
      // row id would hit the primary key rather than duplicate, but the bubble
      // would sit marked Not sent over a message everyone else can already
      // see, so check before saying so.
      if (rowId) {
        const { data: landed } = await supabase
          .from("messages")
          .select("*")
          .eq("id", rowId)
          .maybeSingle();
        if (landed) {
          swapInReal(tempId, landed as Message);
          return;
        }
      }
      setFailedSends((prev) => new Map(prev).set(tempId, { rowId, body, replyTo }));
    }
  }

  async function retrySend(tempId: string): Promise<void> {
    const info = failedSends.get(tempId);
    if (!info) return;
    // Back to the sending look while this attempt runs.
    setFailedSends((prev) => {
      const next = new Map(prev);
      next.delete(tempId);
      return next;
    });
    await deliver(tempId, info.rowId, info.body, info.replyTo);
  }

  function discardFailed(tempId: string): void {
    setFailedSends((prev) => {
      const next = new Map(prev);
      next.delete(tempId);
      return next;
    });
    setMessages((prev) => prev.filter((m) => m.id !== tempId));
  }

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    setShowEmoji(false);

    // Snapshot the reply target and clear the composer NOW, before any await,
    // so nothing typed or changed during the jump round trip is lost or
    // mis-attributed. Both are restored below if the jump fails.
    const replyTarget = replyingTo;
    // Belt and braces alongside the startReply guard: never send a temp id as
    // reply_to (the column is a uuid, it would 22P02 and stick).
    const replyTo = replyingTo && !replyingTo.id.startsWith("temp-") ? replyingTo.id : null;
    setText("");
    setReplyingTo(null);
    // Only the failed-jump path below puts the draft back: a failed send keeps
    // its bubble in the thread instead, so there is nothing to restore.
    const restoreDraft = () => {
      // Anything newer in the box wins, reply target included: putting the
      // old target back on a fresh draft would quote the wrong message.
      if (textRef.current.trim()) return;
      setText(body);
      setReplyingTo(replyTarget);
    };

    // Replying from a search-opened window: get to the live end first, or the
    // new bubble would sit after a gap of unloaded messages. The sending flag
    // is already set, so a second tap during this round trip is ignored, and
    // a failed jump aborts rather than posting into the stale window.
    if (hasNewerRef.current) {
      let jumped = false;
      try {
        jumped = await jumpToLatest();
      } catch {
        jumped = false;
      }
      if (!jumped) {
        setError("Couldn't load the latest messages. Check your connection and try again.");
        restoreDraft();
        setSending(false);
        return;
      }
    }

    // Optimistic: the message appears in the thread THE MOMENT you hit send
    // (slightly faded), like any messaging app. The insert result replaces it;
    // a failure leaves it in place marked Not sent, with Retry, rather than
    // deleting what you wrote.
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Client-generated row id so a lost response can be checked against the
    // server instead of assumed failed (which showed "Couldn't send" for a
    // message that had actually landed, inviting a duplicate).
    const rowId =
      typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : null;
    const optimistic = {
      id: tempId,
      house_id: houseId,
      user_id: currentUserId,
      body,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
    } as Message;
    setMessages((prev) => [...prev, optimistic]);

    try {
      await deliver(tempId, rowId, body, replyTo);
    } finally {
      setSending(false);
    }
  }

  return (
    <div data-chat-shell className="relative flex h-[calc(100dvh-16rem)] flex-col">
      {hasNewer && (
        <button
          type="button"
          onClick={() => void jumpToLatest()}
          className="absolute bottom-[4.5rem] left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft"
        >
          Jump to latest ↓
        </button>
      )}
      {!hasNewer && unseen > 0 && (
        <button
          type="button"
          onClick={() => endRef.current?.scrollIntoView({ behavior: "smooth" })}
          className="absolute bottom-[4.5rem] left-1/2 z-10 -translate-x-1/2 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-soft"
        >
          {unseen} new {unseen === 1 ? "message" : "messages"} ↓
        </button>
      )}
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
            {loadFailed ? (
              <div>
                <p className="text-3xl">📡</p>
                <p className="mt-2 text-slate-500">Couldn&rsquo;t load the messages.</p>
                <button
                  type="button"
                  onClick={() => void catchUp()}
                  className="btn-secondary mt-3 px-4 py-2 text-sm"
                >
                  Try again
                </button>
              </div>
            ) : (
              <div>
                <p className="text-3xl">👋</p>
                <p className="mt-2">No messages yet.</p>
                <p>Say hello to the house!</p>
              </div>
            )}
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
            // Group and time-separate against the previous REAL message: a
            // centred system notice in between must not swallow the next
            // bubble's avatar, name and date header.
            let p = i - 1;
            while (p >= 0 && messages[p].kind === "system") p--;
            const prev = p >= 0 ? messages[p] : undefined;
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
                <div
                  id={`msg-${m.id}`}
                  className={[
                    m.id.startsWith("temp-") && !failedSends.has(m.id) ? "opacity-60" : "",
                    m.id === highlightId
                      ? "rounded-2xl bg-amber-100/70 ring-2 ring-amber-300 transition-colors duration-1000 dark:bg-amber-400/15 dark:ring-amber-400/50"
                      : "transition-colors duration-1000",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined}
                >
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
                  {failedSends.has(m.id) && (
                    <div className="mt-0.5 flex items-center justify-end gap-2 px-1 text-[11px] font-medium text-red-600">
                      Not sent
                      <button
                        type="button"
                        onClick={() => void retrySend(m.id)}
                        className="rounded-md bg-red-50 px-2 py-0.5 font-semibold text-red-700 dark:bg-red-500/15"
                      >
                        Retry
                      </button>
                      <button
                        type="button"
                        onClick={() => discardFailed(m.id)}
                        className="font-medium text-slate-400"
                      >
                        Delete
                      </button>
                    </div>
                  )}
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
