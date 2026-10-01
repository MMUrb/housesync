import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { ids: string[]; payload: { title: string; body: string; url?: string }; pref?: string }[] = [];
vi.mock("@/lib/push", () => ({
  sendPushToUsers: vi.fn(async (ids: string[], payload: { title: string; body: string }, pref?: string) => {
    sent.push({ ids, payload, pref });
  }),
}));

import { runAwayNudges } from "./awayNudges";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Just enough of the supabase-js query builder for runAwayNudges, over arrays.
function fakeDb(tables: Record<string, any[]>) {
  const queried: string[] = [];
  const db = {
    from(table: string) {
      queried.push(table);
      let rows = [...(tables[table] ?? [])];
      let head = false;
      let counting = false;
      let lim = Infinity;
      const b: any = {
        select(_cols: string, opts?: { count?: string; head?: boolean }) {
          head = Boolean(opts?.head);
          counting = Boolean(opts?.count);
          return b;
        },
        eq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] === v)), b),
        neq: (c: string, v: unknown) => ((rows = rows.filter((r) => r[c] != null && r[c] !== v)), b),
        gt: (c: string, v: string) => ((rows = rows.filter((r) => r[c] != null && r[c] > v)), b),
        gte: (c: string, v: string) => ((rows = rows.filter((r) => r[c] != null && r[c] >= v)), b),
        lt: (c: string, v: string) => ((rows = rows.filter((r) => r[c] != null && r[c] < v)), b),
        in: (c: string, vs: unknown[]) => ((rows = rows.filter((r) => vs.includes(r[c]))), b),
        order: (c: string) => ((rows = rows.sort((x, y) => String(x[c]).localeCompare(String(y[c])))), b),
        limit: (n: number) => ((lim = n), b),
        then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) {
          const data = rows.slice(0, lim);
          return Promise.resolve({ data: head ? null : data, error: null, count: counting ? rows.length : null }).then(
            resolve,
            reject,
          );
        },
      };
      return b;
    },
  };
  return { db: db as any, queried };
}

const tables = () => ({
  profiles: [
    // 7 days away (last in 5 Oct): housemates have been busy since
    { id: "u1", name: "Rahul Bagga", last_active_at: "2026-10-05T10:00:00.000Z" },
    { id: "u2", name: "Sam Carter", last_active_at: "2026-10-12T07:00:00.000Z" },
    { id: "u3", name: "Priya Shah", last_active_at: "2026-10-11T20:00:00.000Z" },
    // 7 days away but in no house: left alone
    { id: "u4", name: "Alex", last_active_at: "2026-10-05T12:00:00.000Z" },
    // 8 days away: not today's day, so not picked
    { id: "u5", name: "Jo", last_active_at: "2026-10-04T12:00:00.000Z" },
    // 21 days away (last in 21 Sept), nothing new, owes their one housemate
    { id: "u6", name: "Kim", last_active_at: "2026-09-21T09:00:00.000Z" },
    { id: "u7", name: "Tom Hughes", last_active_at: "2026-10-12T06:00:00.000Z" },
  ],
  house_members: [
    { house_id: "h1", user_id: "u1", joined_at: "2026-09-01T00:00:00Z" },
    { house_id: "h1", user_id: "u2", joined_at: "2026-09-01T00:00:00Z" },
    { house_id: "h1", user_id: "u3", joined_at: "2026-09-02T00:00:00Z" },
    { house_id: "h2", user_id: "u6", joined_at: "2026-08-01T00:00:00Z" },
    { house_id: "h2", user_id: "u7", joined_at: "2026-08-01T00:00:00Z" },
  ],
  houses: [
    { id: "h1", name: "Elm Street", currency: "GBP" },
    { id: "h2", name: "Flat 4", currency: "GBP" },
  ],
  expenses: [
    { id: "e1", house_id: "h1", paid_by: "u2", created_by: "u2", created_at: "2026-10-06T09:00:00.000Z" },
    { id: "e2", house_id: "h1", paid_by: "u2", created_by: "u2", created_at: "2026-10-08T09:00:00.000Z" },
    { id: "e3", house_id: "h1", paid_by: "u1", created_by: "u1", created_at: "2026-10-04T09:00:00.000Z" },
    { id: "e4", house_id: "h2", paid_by: "u7", created_by: "u7", created_at: "2026-09-10T09:00:00.000Z" },
  ],
  messages: [
    { id: "m1", house_id: "h1", user_id: "u3", kind: "user", created_at: "2026-10-07T18:00:00.000Z" },
    { id: "m2", house_id: "h1", user_id: "u3", kind: "system", created_at: "2026-10-07T18:01:00.000Z" },
  ],
  expense_splits: [
    { id: "s1", expense_id: "e4", user_id: "u6", amount_owed: 20, status: "unpaid" },
    { id: "s2", expense_id: "e4", user_id: "u7", amount_owed: 20, status: "confirmed" },
  ],
  settlements: [],
});

describe("runAwayNudges", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("does nothing before the start date, without touching the database", async () => {
    vi.setSystemTime(new Date("2026-10-08T08:00:00Z"));
    const { db, queried } = fakeDb(tables());
    const res = await runAwayNudges(db, Date.now() + 30_000);
    expect(res.considered).toBe(0);
    expect(sent).toHaveLength(0);
    expect(queried).toHaveLength(0);
  });

  it("pushes exactly today's 7- and 21-day cohort, each the right message", async () => {
    vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
    const { db } = fakeDb(tables());
    const res = await runAwayNudges(db, Date.now() + 30_000);

    expect(res.errors).toEqual([]);
    expect(res.considered).toBe(3); // u1, u4 (7 days) and u6 (21 days)
    expect(sent.map((s) => s.ids[0]).sort()).toEqual(["u1", "u6"]);
    expect(sent.every((s) => s.pref === "notify_push_away")).toBe(true);

    const u1 = sent.find((s) => s.ids[0] === "u1")!.payload;
    expect(u1.title).toBe("Elm Street is waiting for you");
    // u1's own expense and the system note don't count
    expect(u1.body).toBe("Sam added 2 expenses and Priya sent 1 message since you were last in. Tap to catch up.");
    expect(u1.url).toBe("/dashboard");

    const u6 = sent.find((s) => s.ids[0] === "u6")!.payload;
    expect(u6.title).toBe("Flat 4 is waiting for you");
    expect(u6.body).toBe("You still owe Tom £20.00. Settle up in a couple of taps.");
    expect(u6.url).toBe("/housemates");
  });

  it("starts nobody new once the deadline has passed, and says so", async () => {
    vi.setSystemTime(new Date("2026-10-12T08:00:00Z"));
    const { db } = fakeDb(tables());
    const res = await runAwayNudges(db, Date.now() - 1);
    expect(sent).toHaveLength(0);
    expect(res.deferred).toBe(3);
    expect(res.errors.join(" ")).toMatch(/3 not sent today/);
  });
});
