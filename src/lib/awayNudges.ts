import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/push";
import { computeBalances } from "@/lib/balances";
import { firstName } from "@/lib/format";
import { awayWindow, composeAwayPush, type AwayState } from "@/lib/awayPush";

// "While you're away": someone in a house who hasn't opened HouseSync for
// AWAY_DAYS[0] days gets one catch-up push, and one more at AWAY_DAYS[1]
// days, then nothing until they come back (opening the app moves
// profiles.last_active_at, so the count starts again). Run last in the daily
// reminders cron, with whatever time the money work leaves.
//
// The trigger is CALENDAR-DAY equality on last_active_at (UTC), like the
// money nudges: each absence matches on exactly one day per step, so nobody
// is pushed twice, whatever time the job runs. The one way to double-send is
// running the job twice on the same day, so never trigger the cron manually
// in production. Respects its own toggle (notify_push_away).
export const AWAY_DAYS = [7, 21] as const;

// last_active_at arrives with migration 0041, whose backfill comes from posts
// and expenses rather than app opens, so on day one a daily reader who never
// posts could look a week away. Nothing is sent until a full week of real app
// opens has been recorded.
const AWAY_NUDGES_FROM = "2026-10-09";

// Backstop for an unusually big day; anyone over it is logged as not sent.
const MAX_PER_RUN = 300;
const CONCURRENCY = 4;
const CHUNK = 100;

/* eslint-disable @typescript-eslint/no-explicit-any */

const PAGE = 500;
async function readAllPages(
  build: (after: string | null) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<any[]> {
  const rows: any[] = [];
  let after: string | null = null;
  for (let i = 0; i < 2000; i++) {
    const { data, error } = await build(after);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as { id: string }[];
    rows.push(...page);
    if (page.length < PAGE) return rows;
    after = page[page.length - 1].id;
  }
  throw new Error("pagination limit reached");
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const countBy = (ids: (string | null)[]) => {
  const m = new Map<string, number>();
  for (const id of ids) if (id) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
};

/**
 * Finds today's away cohort and pushes each person their catch-up. Stops
 * starting new people at `deadline` (ms epoch); anyone left over is counted in
 * `deferred` and logged, because tomorrow their day no longer matches.
 */
export async function runAwayNudges(
  db: SupabaseClient,
  deadline: number,
): Promise<{ pushed: number; considered: number; deferred: number; errors: string[] }> {
  const errors: string[] = [];
  const now = Date.now();
  if (new Date(now).toISOString().slice(0, 10) < AWAY_NUDGES_FROM) {
    return { pushed: 0, considered: 0, deferred: 0, errors };
  }

  // 1. Who: last seen exactly 7 or 21 UTC days ago.
  const cohort: { id: string; lastActive: string }[] = [];
  for (const days of AWAY_DAYS) {
    const { start, end } = awayWindow(days, now);
    const rows = await readAllPages((after) => {
      let q = db
        .from("profiles")
        .select("id, last_active_at")
        .gte("last_active_at", start)
        .lt("last_active_at", end)
        .order("id", { ascending: true })
        .limit(PAGE);
      if (after) q = q.gt("id", after);
      return q;
    });
    for (const r of rows) cohort.push({ id: r.id, lastActive: r.last_active_at });
  }
  if (cohort.length === 0) return { pushed: 0, considered: 0, deferred: 0, errors };

  const people = cohort.slice(0, MAX_PER_RUN);
  let deferred = cohort.length - people.length;

  // 2. Their houses (newest first), the houses' details and everyone in them.
  const memberships = new Map<string, { houseId: string; joinedAt: string }[]>();
  for (const part of chunks(people.map((p) => p.id), CHUNK)) {
    const { data, error } = await db.from("house_members").select("house_id, user_id, joined_at").in("user_id", part);
    if (error) throw new Error(`away memberships: ${error.message}`);
    for (const m of data ?? []) {
      const list = memberships.get(m.user_id) ?? [];
      list.push({ houseId: m.house_id, joinedAt: m.joined_at });
      memberships.set(m.user_id, list);
    }
  }
  const houseIds = [...new Set([...memberships.values()].flat().map((m) => m.houseId))];
  if (houseIds.length === 0) return { pushed: 0, considered: people.length, deferred, errors };

  const houses = new Map<string, { name: string; currency: string }>();
  const membersOf = new Map<string, string[]>();
  for (const part of chunks(houseIds, CHUNK)) {
    const [h, m] = await Promise.all([
      db.from("houses").select("id, name, currency").in("id", part),
      db.from("house_members").select("house_id, user_id").in("house_id", part),
    ]);
    if (h.error) throw new Error(`away houses: ${h.error.message}`);
    if (m.error) throw new Error(`away house members: ${m.error.message}`);
    for (const row of h.data ?? []) houses.set(row.id, { name: row.name, currency: row.currency || "GBP" });
    for (const row of m.data ?? []) membersOf.set(row.house_id, [...(membersOf.get(row.house_id) ?? []), row.user_id]);
  }
  const everyone = [...new Set([...membersOf.values()].flat())];
  const names = new Map<string, string>();
  for (const part of chunks(everyone, CHUNK)) {
    const { data, error } = await db.from("profiles").select("id, name").in("id", part);
    if (error) throw new Error(`away names: ${error.message}`);
    // Only real names: firstName() turns a missing one into "there".
    for (const p of data ?? []) if (p.name?.trim()) names.set(p.id, firstName(p.name));
  }
  const nameOf = (id: string) => names.get(id) ?? null;
  const monthStart = `${new Date(now).toISOString().slice(0, 7)}-01T00:00:00Z`;

  // 3. One person: what changed in their houses since they were last in.
  async function stateFor(userId: string, since: string): Promise<AwayState | null> {
    const theirs = (memberships.get(userId) ?? [])
      .filter((m) => houses.has(m.houseId))
      .sort((a, b) => b.joinedAt.localeCompare(a.joinedAt));
    if (theirs.length === 0) return null; // no house: the in-app join prompt covers them

    // The house with the most going on; ties go to the newest membership.
    let best: { houseId: string; exp: Map<string, number>; msg: Map<string, number>; total: number } | null = null;
    for (const { houseId } of theirs) {
      const [e, m] = await Promise.all([
        db.from("expenses").select("created_by").eq("house_id", houseId).gt("created_at", since).neq("created_by", userId).limit(500),
        db.from("messages").select("user_id").eq("house_id", houseId).eq("kind", "user").gt("created_at", since).neq("user_id", userId).limit(500),
      ]);
      if (e.error) throw new Error(`away expenses: ${e.error.message}`);
      if (m.error) throw new Error(`away messages: ${m.error.message}`);
      const exp = countBy((e.data ?? []).map((r: any) => r.created_by));
      const msg = countBy((m.data ?? []).map((r: any) => r.user_id));
      const total = [...exp.values(), ...msg.values()].reduce((t, n) => t + n, 0);
      if (!best || total > best.total) best = { houseId, exp, msg, total };
    }
    const pick = best!;
    const house = houses.get(pick.houseId)!;
    const members = membersOf.get(pick.houseId) ?? [userId];
    const others = members.filter((id) => id !== userId);
    const byCount = (m: Map<string, number>) =>
      [...m.entries()].map(([id, count]) => ({ name: nameOf(id), count })).sort((a, b) => b.count - a.count);

    const state: AwayState = {
      houseName: house.name,
      currency: house.currency,
      expensesBy: byCount(pick.exp),
      messagesBy: byCount(pick.msg),
      net: 0,
      onlyOther: others.length === 1 ? nameOf(others[0]) : null,
      memberCount: members.length,
      addedThisMonth: 0,
    };
    if (pick.total > 0) return state; // the activity version doesn't need the rest

    // Nothing new: is money still open (the same source as the Monday digest)?
    const expenses = await readAllPages((after) => {
      let q = db.from("expenses").select("id, paid_by").eq("house_id", pick.houseId).order("id", { ascending: true }).limit(PAGE);
      if (after) q = q.gt("id", after);
      return q;
    });
    const splits: any[] = [];
    for (const part of chunks(expenses.map((x: any) => x.id), CHUNK)) {
      splits.push(
        ...(await readAllPages((after) => {
          let q = db
            .from("expense_splits")
            .select("id, expense_id, user_id, amount_owed, status")
            .in("expense_id", part)
            .order("id", { ascending: true })
            .limit(PAGE);
          if (after) q = q.gt("id", after);
          return q;
        })),
      );
    }
    const { data: setts, error: settErr } = await db.from("settlements").select("*").eq("house_id", pick.houseId);
    if (settErr) throw new Error(`away settlements: ${settErr.message}`);
    state.net = computeBalances(expenses as any, splits as any, userId, (setts ?? []) as any).netByUser[userId] ?? 0;

    const { count, error: monthErr } = await db
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("house_id", pick.houseId)
      .gte("created_at", monthStart);
    if (monthErr) throw new Error(`away month count: ${monthErr.message}`);
    state.addedThisMonth = count ?? 0;
    return state;
  }

  // 4. A few people at a time, nobody new after the deadline.
  let pushed = 0;
  let next = 0;
  const worker = async () => {
    while (next < people.length) {
      if (Date.now() >= deadline) return;
      const person = people[next++];
      try {
        const state = await stateFor(person.id, person.lastActive);
        if (!state) continue;
        await sendPushToUsers([person.id], composeAwayPush(state), "notify_push_away");
        pushed++;
      } catch (e) {
        errors.push(`away ${person.id}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  deferred += people.length - Math.min(next, people.length);
  if (deferred > 0) errors.push(`away nudges: ${deferred} not sent today (time or run cap)`);
  return { pushed, considered: people.length, deferred, errors };
}
