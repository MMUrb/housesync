"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// House tables that carry a house_id, so we can subscribe scoped to this house.
// (messages is handled live by the chat component; expense_splits is below.)
const SCOPED_TABLES = ["expenses", "recurring_bills", "chores", "activity", "house_members", "notices"] as const;

/**
 * Streams the active house's data over Supabase Realtime and does a soft,
 * debounced router.refresh() whenever anything changes — so an expense, bill,
 * chore or settle-up by one housemate shows up for everyone within a second,
 * with no manual reload. Mounted once in the app layout.
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
    channel.subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [houseId, router]);

  return null;
}
