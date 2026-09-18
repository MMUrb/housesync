import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Analytics helpers shared by the admin dashboard. Everything here reads with
// the service-role client, so these must only ever be called behind adminGate.

export const DAY = 86_400_000;

/** UTC date key, e.g. "2026-07-30". Used as the bucket key for every series. */
export const dayOf = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** The last n UTC day keys, oldest first, including today. */
export function lastNDays(n: number): string[] {
  const days: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

/** Count rows into day buckets, keeping days with no rows at zero. */
export function bucketByDay(
  rows: { created_at: string }[],
  days: string[],
): { day: string; value: number }[] {
  const counts = new Map(days.map((d) => [d, 0]));
  for (const r of rows) {
    const k = dayOf(r.created_at);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return days.map((d) => ({ day: d, value: counts.get(d) ?? 0 }));
}

export function topCounts(items: string[], n: number): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const it of items) m.set(it, (m.get(it) ?? 0) + 1);
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, value]) => ({ label, value }));
}

export type ActionRow = { user_id: string | null; house_id: string; created_at: string };

/**
 * Every real in-app action in the window, from the two tables that record one:
 * `activity` (expenses, bills, chores, settle-ups, notices, shopping) and
 * `messages` (chat). This is a far better signal than auth.last_sign_in_at,
 * which only moves on a fresh sign-in and so badly understates daily use.
 *
 * Capped, because these are the highest-volume tables in the database. The cap
 * is reported back so callers can say so rather than quietly under-reporting.
 */
export async function recentActions(
  admin: SupabaseClient,
  sinceIso: string,
  cap = 100_000,
): Promise<{ rows: ActionRow[]; capped: boolean }> {
  const half = Math.floor(cap / 2);
  const [act, msg] = await Promise.all([
    admin
      .from("activity")
      .select("user_id, house_id, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(half),
    admin
      .from("messages")
      .select("user_id, house_id, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(half),
  ]);

  const a = (act.data ?? []) as ActionRow[];
  const m = (msg.data ?? []) as ActionRow[];
  return { rows: [...a, ...m], capped: a.length >= half || m.length >= half };
}

/** Distinct users who did something at or after `fromMs`. */
export function activeUsers(rows: ActionRow[], fromMs: number): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (!r.user_id) continue;
    if (new Date(r.created_at).getTime() >= fromMs) s.add(r.user_id);
  }
  return s;
}

/** Distinct houses that saw activity at or after `fromMs`. */
export function activeHouses(rows: ActionRow[], fromMs: number): Set<string> {
  const s = new Set<string>();
  for (const r of rows) {
    if (!r.house_id) continue;
    if (new Date(r.created_at).getTime() >= fromMs) s.add(r.house_id);
  }
  return s;
}

/** Distinct active users per day, for the DAU series. */
export function dailyActiveSeries(
  rows: ActionRow[],
  days: string[],
): { day: string; value: number }[] {
  const perDay = new Map<string, Set<string>>(days.map((d) => [d, new Set<string>()]));
  for (const r of rows) {
    if (!r.user_id) continue;
    const set = perDay.get(dayOf(r.created_at));
    if (set) set.add(r.user_id);
  }
  return days.map((d) => ({ day: d, value: perDay.get(d)?.size ?? 0 }));
}

/**
 * The newest moment we have evidence each user actually used the app.
 *
 * auth.last_sign_in_at is NOT that: Supabase only moves it on a fresh
 * authentication, and sessions here persist and refresh silently, so someone
 * who opens the app daily keeps the timestamp from the day they signed up.
 * That made the admin directory look like nobody ever came back.
 *
 * profiles.last_active_at (written by the LastSeenBeacon on every app open)
 * is exact, but only from the day it shipped. For everything before that we
 * fall back to the newest row this person left in any table: a message, a
 * chat-read watermark, an expense, a completed chore, an activity entry.
 * Rows are pulled newest-first, so the first one seen per user is their
 * latest.
 */
export async function lastSeenByUser(
  admin: SupabaseClient,
  cap = 20_000,
): Promise<Map<string, string>> {
  const newest = new Map<string, string>();
  const bump = (userId: string | null | undefined, iso: string | null | undefined) => {
    if (!userId || !iso) return;
    const cur = newest.get(userId);
    if (!cur || iso > cur) newest.set(userId, iso);
  };

  const [beacon, activity, messages, reads, expenses, chores] = await Promise.all([
    admin.from("profiles").select("id, last_active_at").not("last_active_at", "is", null),
    admin.from("activity").select("user_id, created_at").order("created_at", { ascending: false }).limit(cap),
    admin.from("messages").select("user_id, created_at").order("created_at", { ascending: false }).limit(cap),
    admin.from("message_reads").select("user_id, last_read_at").order("last_read_at", { ascending: false }).limit(cap),
    admin.from("expenses").select("created_by, created_at").order("created_at", { ascending: false }).limit(cap),
    admin
      .from("chores")
      .select("completed_by, completed_at")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(cap),
  ]);

  // Best-effort per source: the beacon column doesn't exist until migration
  // 0041 runs, and one missing source must not blank the whole column.
  for (const r of (beacon.data ?? []) as { id: string; last_active_at: string | null }[]) {
    bump(r.id, r.last_active_at);
  }
  for (const r of (activity.data ?? []) as { user_id: string | null; created_at: string }[]) {
    bump(r.user_id, r.created_at);
  }
  for (const r of (messages.data ?? []) as { user_id: string | null; created_at: string }[]) {
    bump(r.user_id, r.created_at);
  }
  for (const r of (reads.data ?? []) as { user_id: string | null; last_read_at: string }[]) {
    bump(r.user_id, r.last_read_at);
  }
  for (const r of (expenses.data ?? []) as { created_by: string | null; created_at: string }[]) {
    bump(r.created_by, r.created_at);
  }
  for (const r of (chores.data ?? []) as { completed_by: string | null; completed_at: string }[]) {
    bump(r.completed_by, r.completed_at);
  }
  return newest;
}

/**
 * How many distinct houses have ever used a given feature. Counted by pulling
 * house_id and de-duplicating, so it is exact up to the cap and flagged beyond.
 */
export async function housesUsingFeature(
  admin: SupabaseClient,
  table: string,
  cap = 50_000,
): Promise<{ houses: number; capped: boolean }> {
  const { data } = await admin.from(table).select("house_id").limit(cap);
  const rows = (data ?? []) as { house_id: string | null }[];
  const set = new Set<string>();
  for (const r of rows) if (r.house_id) set.add(r.house_id);
  return { houses: set.size, capped: rows.length >= cap };
}
