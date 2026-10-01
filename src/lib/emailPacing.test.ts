import { afterEach, describe, expect, it, vi } from "vitest";
import { createPacer, describeProviderError, retryDelayMs, sendPaced } from "./emailPacing";

/** A stand-in for Resend that enforces its real rule: >10 starts in 1s is a 429. */
function fakeResend() {
  const starts: number[] = [];
  const send = async () => {
    const t = Date.now();
    const inLastSecond = starts.filter((s) => t - s < 1000).length;
    starts.push(t);
    return new Response(
      inLastSecond >= 10 ? JSON.stringify({ name: "rate_limit_exceeded", statusCode: 429 }) : "{}",
      { status: inLastSecond >= 10 ? 429 : 200 },
    );
  };
  return { send, starts };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("the 01/10/2026 reminders burst", () => {
  it("reproduces the bug: an unpaced burst of 30 gets 20 refused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const resend = fakeResend();
    const results = await Promise.all(Array.from({ length: 30 }, () => resend.send()));
    expect(results.filter((r) => r.status === 429)).toHaveLength(20);
  });

  it("fixed: the same burst through the pacer is never refused", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const resend = fakeResend();
    const pace = createPacer(200);
    // Six workers' worth of concurrency and then some: everything at once.
    const all = Promise.all(Array.from({ length: 30 }, () => sendPaced(resend.send, { slot: pace })));
    await vi.runAllTimersAsync();
    const results = await all;
    expect(results.every((r) => r.status === 200)).toBe(true);
    // Exactly one attempt per email: nothing needed a retry.
    expect(resend.starts).toHaveLength(30);
  });
});

describe("createPacer", () => {
  it("hands concurrent callers evenly spaced slots", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const pace = createPacer(200);
    const started: number[] = [];
    const all = Promise.all(
      Array.from({ length: 4 }, () => pace().then(() => started.push(Date.now()))),
    );
    await vi.runAllTimersAsync();
    await all;
    expect(started).toEqual([1_000, 1_200, 1_400, 1_600]);
  });

  it("does not make an idle sender wait", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(5_000);
    const pace = createPacer(200);
    await pace();
    vi.setSystemTime(9_000); // long after the last slot
    const before = Date.now();
    await pace();
    expect(Date.now()).toBe(before);
  });
});

describe("sendPaced", () => {
  const noWait = async () => {};

  it("retries a 429 and returns the eventual success", async () => {
    let calls = 0;
    let slots = 0;
    const res = await sendPaced(
      async () => new Response("{}", { status: ++calls < 3 ? 429 : 200 }),
      { slot: async () => void slots++, sleep: noWait },
    );
    expect(res.status).toBe(200);
    expect(calls).toBe(3);
    // Every retry queues for a slot again rather than jumping the line.
    expect(slots).toBe(3);
  });

  it("gives up after maxRetries and hands back the 429", async () => {
    let calls = 0;
    const res = await sendPaced(
      async () => {
        calls++;
        return new Response("{}", { status: 429 });
      },
      { slot: noWait, sleep: noWait, maxRetries: 2 },
    );
    expect(res.status).toBe(429);
    expect(calls).toBe(3); // the first try plus two retries
  });

  it("never retries anything but a 429, so it can never double-send", async () => {
    for (const status of [200, 400, 422, 500, 503]) {
      let calls = 0;
      const res = await sendPaced(
        async () => {
          calls++;
          return new Response("{}", { status });
        },
        { slot: noWait, sleep: noWait },
      );
      expect(res.status).toBe(status);
      expect(calls).toBe(1);
    }
  });
});

describe("retryDelayMs", () => {
  const noJitter = () => 0;

  it("honours retry-after in seconds", () => {
    expect(retryDelayMs(new Headers({ "retry-after": "1" }), 0, 2_000, noJitter)).toBe(1_000);
  });

  it("falls back to ratelimit-reset, then exponential backoff", () => {
    expect(retryDelayMs(new Headers({ "ratelimit-reset": "1" }), 0, 2_000, noJitter)).toBe(1_000);
    expect(retryDelayMs(new Headers(), 0, 2_000, noJitter)).toBe(500);
    expect(retryDelayMs(new Headers(), 1, 2_000, noJitter)).toBe(1_000);
  });

  it("caps the wait so one email can't eat the cron's time budget", () => {
    expect(retryDelayMs(new Headers({ "retry-after": "60" }), 0, 2_000, noJitter)).toBe(2_000);
  });

  it("adds at most 250ms of jitter", () => {
    const d = retryDelayMs(new Headers({ "retry-after": "1" }), 0, 2_000, () => 0.999);
    expect(d).toBeGreaterThanOrEqual(1_000);
    expect(d).toBeLessThan(1_250);
  });
});

describe("describeProviderError", () => {
  it("shrinks a 429 to one readable phrase", () => {
    const body = JSON.stringify({
      message: "Too many requests. You can only make 10 requests per second. See rate limit response headers for more information. Or contact support to increase rate limit.",
      name: "rate_limit_exceeded",
      statusCode: 429,
    });
    expect(describeProviderError("Resend", 429, body)).toBe("Resend 429 rate_limit_exceeded");
  });

  it("keeps the useful detail of other errors", () => {
    const body = JSON.stringify({ name: "validation_error", message: "Invalid `to` field." });
    expect(describeProviderError("Resend", 422, body)).toBe(
      "Resend 422 validation_error: Invalid `to` field.",
    );
  });

  it("copes with a body that isn't JSON, and clips long ones", () => {
    expect(describeProviderError("Brevo", 502, "Bad Gateway")).toBe("Brevo 502: Bad Gateway");
    const long = "x".repeat(400);
    expect(describeProviderError("Brevo", 500, long).length).toBeLessThan(180);
  });
});
