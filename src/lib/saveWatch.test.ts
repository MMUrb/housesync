import { describe, expect, it } from "vitest";
import {
  backgroundSignal,
  describeSave,
  summariseRefusal,
  watchSaves,
  type SaveWatchEnv,
} from "./saveWatch";

const BASE = "https://abc.supabase.co";

/** Lets the background read of the refused body finish. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

function setup(opts: {
  respond?: () => Response | Promise<Response>;
  env?: Partial<SaveWatchEnv>;
  report?: (m: string) => void;
}) {
  const reports: string[] = [];
  const env: SaveWatchEnv = {
    isVisible: () => true,
    isOnline: () => true,
    lastHiddenAt: () => 0,
    now: () => 1_000,
    ...opts.env,
  };
  const fetchFn = watchSaves(
    async () => (opts.respond ? opts.respond() : new Response("[]", { status: 201 })),
    opts.report ?? ((m) => reports.push(m)),
    env,
  );
  return { fetchFn, reports };
}

const refusal = (status: number, body: object) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("describeSave", () => {
  it("names saves by table or action", () => {
    expect(describeSave(`${BASE}/rest/v1/expenses?select=*`, "POST")).toBe("expenses (insert)");
    expect(describeSave(`${BASE}/rest/v1/chores?id=eq.1`, "PATCH")).toBe("chores (update)");
    expect(describeSave(`${BASE}/rest/v1/notices?id=eq.1`, "DELETE")).toBe("notices (delete)");
    expect(describeSave(`${BASE}/rest/v1/rpc/pay_itemised`, "POST")).toBe("rpc pay_itemised");
    expect(describeSave(`${BASE}/storage/v1/object/receipts/h1/a.jpg`, "POST")).toBe(
      "storage receipts (upload)",
    );
  });

  it("ignores reads, storage reads and all sign-in traffic", () => {
    expect(describeSave(`${BASE}/rest/v1/expenses?select=*`, "GET")).toBeNull();
    expect(describeSave(`${BASE}/rest/v1/expenses`, "HEAD")).toBeNull();
    expect(describeSave(`${BASE}/storage/v1/object/sign/receipts/a.jpg`, "POST")).toBeNull();
    expect(describeSave(`${BASE}/auth/v1/token?grant_type=password`, "POST")).toBeNull();
    expect(describeSave("not a url", "POST")).toBeNull();
  });
});

describe("summariseRefusal", () => {
  it("keeps the code and message but never details or hint, which can quote row values", () => {
    const body = JSON.stringify({
      code: "23514",
      message: 'new row for relation "expenses" violates check constraint "expenses_amount_check"',
      details: "Failing row contains (Pizza night, -5.00, ...)",
      hint: null,
    });
    const s = summariseRefusal(body);
    expect(s).toBe('23514: new row for relation "expenses" violates check constraint "expenses_amount_check"');
    expect(s).not.toContain("Pizza");
  });
});

describe("watchSaves", () => {
  it("reports a refused save and still hands the caller the untouched response", async () => {
    const { fetchFn, reports } = setup({
      respond: () =>
        refusal(403, { code: "42501", message: 'new row violates row-level security policy for table "expenses"' }),
    });
    const res = await fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST", body: "{}" });
    // The app's own error handling must still see the original body.
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("42501");
    await settle();
    expect(reports).toEqual([
      'Save failed: expenses (insert): 403 42501: new row violates row-level security policy for table "expenses"',
    ]);
  });

  it("reports a database function's refusal by its fixed code", async () => {
    const { fetchFn, reports } = setup({
      respond: () => refusal(400, { code: "P0001", message: "pay_more_than_owed" }),
    });
    await fetchFn(`${BASE}/rest/v1/rpc/pay_itemised`, { method: "POST", body: "{}" });
    await settle();
    expect(reports).toEqual(["Save failed: rpc pay_itemised: 400 P0001: pay_more_than_owed"]);
  });

  it("stays quiet when the row already exists (a retry whose first attempt landed)", async () => {
    const { fetchFn, reports } = setup({
      respond: () => refusal(409, { code: "23505", message: "duplicate key value violates unique constraint" }),
    });
    const res = await fetchFn(`${BASE}/rest/v1/settlements`, { method: "POST", body: "{}" });
    expect(res.status).toBe(409);
    await settle();
    expect(reports).toEqual([]);
  });

  it("says nothing about successful saves, reads or sign-in attempts", async () => {
    const ok = setup({});
    await ok.fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST", body: "{}" });
    const failingRead = setup({ respond: () => refusal(500, { message: "boom" }) });
    await failingRead.fetchFn(`${BASE}/rest/v1/expenses?select=*`, { method: "GET" });
    const wrongPassword = setup({ respond: () => refusal(400, { error: "invalid_grant" }) });
    await wrongPassword.fetchFn(`${BASE}/auth/v1/token?grant_type=password`, { method: "POST" });
    await settle();
    expect([...ok.reports, ...failingRead.reports, ...wrongPassword.reports]).toEqual([]);
  });

  it("reports a dropped connection while the page was in view, and still fails the save", async () => {
    const { fetchFn, reports } = setup({
      respond: () => {
        throw new TypeError("Load failed");
      },
    });
    await expect(fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST" })).rejects.toThrow("Load failed");
    expect(reports).toEqual(["Save failed: expenses (insert): connection dropped (Load failed)"]);
  });

  it("ignores requests killed because the app went into the background (iOS)", async () => {
    // Started at 1000, the page hid at 1500, and the failure landed after reopening.
    const { fetchFn, reports } = setup({
      respond: () => {
        throw new TypeError("Load failed");
      },
      env: { lastHiddenAt: () => 1_500 },
    });
    await expect(fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST" })).rejects.toThrow();
    expect(reports).toEqual([]);
  });

  it("ignores failures while offline, and requests cancelled on purpose", async () => {
    const offline = setup({
      respond: () => {
        throw new TypeError("Failed to fetch");
      },
      env: { isOnline: () => false },
    });
    await expect(offline.fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST" })).rejects.toThrow();
    const aborted = setup({
      respond: () => {
        throw new DOMException("The operation was aborted.", "AbortError");
      },
    });
    await expect(aborted.fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST" })).rejects.toThrow();
    expect([...offline.reports, ...aborted.reports]).toEqual([]);
  });

  it("ignores a dropped connection on a background write (the 06-07/10/2026 last-seen noise)", async () => {
    // Exactly the three entries that showed up: the last-seen recorder, on
    // /dashboard, failing as the app opened. Marked background, it's silent.
    const { fetchFn, reports } = setup({
      respond: () => {
        throw new TypeError("Load failed");
      },
    });
    await expect(
      fetchFn(`${BASE}/rest/v1/profiles?id=eq.u1`, { method: "PATCH", signal: backgroundSignal() }),
    ).rejects.toThrow("Load failed");
    expect(reports).toEqual([]);
  });

  it("still reports a background write the database refused, labelled as background", async () => {
    const { fetchFn, reports } = setup({ respond: () => refusal(403, { code: "42501", message: "rls" }) });
    await fetchFn(`${BASE}/rest/v1/message_reads`, { method: "POST", signal: backgroundSignal() });
    await settle();
    expect(reports).toEqual(["Background save failed: message_reads (insert): 403 42501: rls"]);
  });

  it("keeps reporting the same table when a person saves it (a profile edit)", async () => {
    const { fetchFn, reports } = setup({
      respond: () => {
        throw new TypeError("Load failed");
      },
    });
    await expect(fetchFn(`${BASE}/rest/v1/profiles?id=eq.u1`, { method: "PATCH" })).rejects.toThrow();
    expect(reports).toEqual(["Save failed: profiles (update): connection dropped (Load failed)"]);
  });

  it("hands the background mark to the network untouched, so it never changes the request", async () => {
    const signal = backgroundSignal();
    let seen: AbortSignal | null | undefined;
    const fetchFn = watchSaves(
      async (_input, init) => {
        seen = init?.signal;
        return new Response("[]", { status: 200 });
      },
      () => {},
      { isVisible: () => true, isOnline: () => true, lastHiddenAt: () => 0, now: () => 0 },
    );
    await fetchFn(`${BASE}/rest/v1/profiles?id=eq.u1`, { method: "PATCH", signal });
    expect(seen).toBe(signal);
    expect(signal.aborted).toBe(false);
  });

  it("never lets a failing reporter break the save", async () => {
    const { fetchFn } = setup({
      respond: () => refusal(403, { code: "42501", message: "rls" }),
      report: () => {
        throw new Error("reporter down");
      },
    });
    const res = await fetchFn(`${BASE}/rest/v1/expenses`, { method: "POST" });
    await settle();
    expect(res.status).toBe(403);
  });
});
