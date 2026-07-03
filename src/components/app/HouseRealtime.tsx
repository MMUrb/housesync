"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { emitHouseMessage } from "@/lib/houseMessages";
import type { Message } from "@/lib/types";

// House tables that carry a house_id, so we can subscribe scoped to this house.
// (messages + expense_splits are handled separately below.)
const SCOPED_TABLES = ["expenses", "recurring_bills", "chores", "activity", "house_members", "notices"] as const;

/**
 * The app's single Supabase Realtime channel, mounted once in the app layout.
 * It does two jobs off ONE connection (instead of the four channels this used to
 * take):
 *   1. Data changes -> a soft, debounced router.refresh(), so an expense, bill,
 *      chore or settle-up by one housemate shows up for everyone within a second
 *      with no manual reload.
 *   2. New chat messages -> re-broadcast on the window (see houseMessages.ts) so
 *      the chat view, the nav badge and the switcher badges can all react to one
 *      shared stream rather than each opening their own channel.
 *
 * router.refresh() is a soft refresh: it re-fetches the server components for
 * the current route but preserves client state (so a half-filled form isn't
 * lost) and scroll position.
 */
export function HouseRealtime({ houseId }: { houseId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = createClient();

    // Coalesce bursts (an expense insert fires expense + splits + activity rows)
    // into a single refresh.
    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 400);
    };

    const channel = supabase.channel(`house-sync:${houseId}`);
    for (const table of SCOPED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `house_id=eq.${houseId}` },
        refresh,
      );
    }
    // expense_splits has no house_id column to filter on; RLS still limits
    // delivery to splits in the user's own houses, so this is safe.
    channel.on("postgres_changes", { event: "*", schema: "public", table: "expense_splits" }, refresh);
    // New messages across ALL the user's houses (RLS scopes delivery to houses
    // they belong to). Unfiltered on purpose so the switcher can badge other
    // houses too; each consumer filters by house_id itself.
    channel.on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "messages" },
      (payload) => emitHouseMessage(payload.new as Message),
    );
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [houseId, router]);

  return null;
}
