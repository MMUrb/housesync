import { afterEach, describe, expect, it, vi } from "vitest";
import { runPool } from "./pool";

afterEach(() => {
  vi.useRealTimers();
});

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runPool", () => {
  it("never has more than the limit in flight, and keeps input order", async () => {
    vi.useFakeTimers();
    let inFlight = 0;
    let peak = 0;
    const p = runPool([5, 1, 4, 2, 3, 6, 7], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await wait(n * 10);
      inFlight--;
      return n * 2;
    });
    await vi.runAllTimersAsync();
    const out = await p;
    expect(peak).toBe(3);
    expect(out.results).toEqual([10, 2, 8, 4, 6, 12, 14]);
    expect(out.started).toBe(7);
    expect(out.error).toBeUndefined();
    expect(out.outOfTime).toBe(false);
  });

  it("starts nothing new after the first error, and reports it", async () => {
    vi.useFakeTimers();
    const touched: number[] = [];
    const p = runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      touched.push(n);
      // 2 fails at 10ms while 1 is still running (until 20ms).
      await wait(n === 2 ? 10 : 20);
      if (n === 2) throw new Error("Apple needs an agreement");
      return n;
    });
    await vi.runAllTimersAsync();
    const out = await p;
    expect((out.error as Error).message).toBe("Apple needs an agreement");
    // 1 and 2 ran together; 2 failed first, so when 1 finished nothing new
    // started, but 1's own result was still kept.
    expect(touched).toEqual([1, 2]);
    expect(out.started).toBe(2);
    expect(out.results).toEqual([1, undefined, undefined, undefined, undefined, undefined]);
  });

  it("stops starting work at the deadline but lets in-flight work finish", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const p = runPool([1, 2, 3, 4, 5, 6, 7, 8], 2, async (n) => {
      await wait(100);
      return n;
    }, { deadline: 250 });
    await vi.runAllTimersAsync();
    const out = await p;
    // Starts at 0, 0, 100, 100, 200, 200; at 300 the deadline has passed.
    expect(out.started).toBe(6);
    expect(out.outOfTime).toBe(true);
    expect(out.results.slice(0, 6)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(out.results.slice(6)).toEqual([undefined, undefined]);
  });

  it("handles an empty list", async () => {
    const out = await runPool([], 5, async () => 1);
    expect(out).toEqual({ results: [], started: 0, error: undefined, outOfTime: false });
  });

  it("matches the 05/10/2026 measurement: 72 Apple days at 0.6s, five at a time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const p = runPool(Array.from({ length: 72 }, (_, i) => i), 5, async (i) => {
      await wait(600);
      return i % 2 === 0 ? { day: i } : null; // 404 days come back as null
    }, { deadline: 40_000 });
    await vi.runAllTimersAsync();
    const out = await p;
    expect(out.started).toBe(72);
    expect(out.outOfTime).toBe(false);
    // ceil(72 / 5) rounds of 0.6s: 8.8s, against 43.2s one at a time.
    expect(Date.now()).toBe(Math.ceil(72 / 5) * 600);
  });
});
