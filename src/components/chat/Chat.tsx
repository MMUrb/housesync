"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import type { MemberWithProfile, Message } from "@/lib/types";

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
  const endRef = useRef<HTMLDivElement | null>(null);

  const profileOf = (userId: string) =>
    members.find((m) => m.user_id === userId)?.profile ?? null;

  // Add a message only if we don't already have it — dedupes the optimistic
  // copy against the same row arriving over Realtime.
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

  async function send() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({ house_id: houseId, user_id: currentUserId, body })
        .select()
        .single();
      if (error) throw error;
      if (data) addMessage(data as Message);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send — please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col">
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
            const startGroup = !prev || prev.user_id !== m.user_id;
            const prof = profileOf(m.user_id);
            return (
              <Bubble
                key={m.id}
                mine={m.user_id === currentUserId}
                name={prof?.name ?? "Housemate"}
                color={prof?.avatar_color ?? "#6f53f5"}
                body={m.body}
                at={m.created_at}
                startGroup={startGroup}
              />
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-100 pt-3">
        <div className="flex items-end gap-2">
          <textarea
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
  body,
  at,
  startGroup,
}: {
  mine: boolean;
  name: string;
  color: string;
  body: string;
  at: string;
  startGroup: boolean;
}) {
  const time = new Date(at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div
      className={`flex gap-2 ${mine ? "justify-end" : "justify-start"} ${
        startGroup ? "mt-3" : "mt-1"
      }`}
    >
      {!mine && (
        <div className="w-7 shrink-0 self-end">
          {startGroup && <Avatar name={name} color={color} size="sm" />}
        </div>
      )}
      <div className={`flex max-w-[78%] flex-col ${mine ? "items-end" : "items-start"}`}>
        {!mine && startGroup && (
          <span className="mb-0.5 px-1 text-[11px] font-medium text-slate-500">{name}</span>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm leading-snug ${
            mine
              ? "rounded-br-md bg-brand-600 text-white"
              : "rounded-bl-md bg-slate-100 text-slate-900"
          }`}
        >
          <span className="whitespace-pre-wrap break-words">{body}</span>
        </div>
        <span className="mt-0.5 px-1 text-[10px] text-slate-400">{time}</span>
      </div>
    </div>
  );
}
