import { describe, expect, it } from "vitest";
import {
  ALERTS_PROMPT_EVERY_MS,
  alertsPromptDue,
  describePayment,
  latestPaymentTo,
  nextAlertsRecord,
  paidWhen,
  parseAlertsRecord,
  paymentTypesOff,
  pickAlertsMode,
  type AlertsDevice,
} from "./paymentAlerts";

// Friday 02/10/2026, 13:00 in the UK (BST).
const NOW = Date.parse("2026-10-02T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const daysAgo = (d: number) => hoursAgo(d * 24);

describe("paymentTypesOff", () => {
  it("names the payment switches that are off", () => {
    expect(paymentTypesOff({ notify_push_paid: false, notify_push_bill: true })).toEqual(["Payments to you"]);
    expect(paymentTypesOff({ notify_push_paid: false, notify_push_bill: false })).toEqual([
      "Payments to you",
      "Bill requests",
    ]);
  });

  it("treats a missing row or column as on, and ignores non-payment switches", () => {
    expect(paymentTypesOff(null)).toEqual([]);
    expect(paymentTypesOff({})).toEqual([]);
    expect(paymentTypesOff({ notify_push_message: false, notify_push_chore: false })).toEqual([]);
  });
});

describe("how often it shows", () => {
  it("is due on a device that has never shown it", () => {
    expect(alertsPromptDue(parseAlertsRecord(null), NOW)).toBe(true);
  });

  it("waits a fortnight between showings", () => {
    const shown = nextAlertsRecord(parseAlertsRecord(null), NOW);
    expect(alertsPromptDue(shown, NOW + ALERTS_PROMPT_EVERY_MS - 1)).toBe(false);
    expect(alertsPromptDue(shown, NOW + ALERTS_PROMPT_EVERY_MS)).toBe(true);
  });

  it("stops for good after three showings", () => {
    let rec = parseAlertsRecord(null);
    for (let i = 0; i < 3; i++) rec = nextAlertsRecord(rec, NOW + i * ALERTS_PROMPT_EVERY_MS);
    expect(rec.count).toBe(3);
    expect(alertsPromptDue(rec, NOW + 50 * ALERTS_PROMPT_EVERY_MS)).toBe(false);
  });

  it("round-trips through storage, and a garbled value never means show every visit", () => {
    const rec = nextAlertsRecord(parseAlertsRecord(null), NOW);
    expect(parseAlertsRecord(JSON.stringify(rec))).toEqual(rec);
    expect(alertsPromptDue(parseAlertsRecord("{not json"), NOW)).toBe(false);
  });
});

describe("pickAlertsMode", () => {
  const native = (over: Partial<Extract<AlertsDevice, { kind: "native" }>>): AlertsDevice => ({
    kind: "native",
    perm: "prompt",
    registered: false,
    optedOut: false,
    ...over,
  });
  const web = (over: Partial<Extract<AlertsDevice, { kind: "web" }>>): AlertsDevice => ({
    kind: "web",
    supported: true,
    perm: "default",
    subscribed: false,
    pushElsewhere: false,
    ...over,
  });

  it("app: blocked in the phone's settings gets the steps, whatever else is true", () => {
    expect(pickAlertsMode(native({ perm: "denied" }), false)).toBe("blocked");
    expect(pickAlertsMode(native({ perm: "denied", optedOut: true, registered: true }), true)).toBe("blocked");
  });

  it("app: on, but a payment switch is off, gets turn-them-all-on", () => {
    expect(pickAlertsMode(native({ perm: "granted", registered: true }), true)).toBe("partial");
    expect(pickAlertsMode(native({ perm: "granted", registered: true }), false)).toBeNull();
  });

  it("app: off is left to the first-run ask until they've opted out", () => {
    expect(pickAlertsMode(native({ perm: "prompt" }), false)).toBeNull();
    expect(pickAlertsMode(native({ perm: "granted" }), false)).toBeNull();
    expect(pickAlertsMode(native({ perm: "prompt", optedOut: true }), false)).toBe("off");
    expect(pickAlertsMode(native({ perm: "granted", optedOut: true }), true)).toBe("off");
  });

  it("web: only browsers that can do notifications, and never once blocked", () => {
    expect(pickAlertsMode(web({ supported: false }), true)).toBeNull();
    expect(pickAlertsMode(web({ perm: "denied" }), false)).toBeNull();
    expect(pickAlertsMode(web({ perm: "default" }), false)).toBe("off");
    expect(pickAlertsMode(web({ perm: "granted", subscribed: false }), false)).toBe("off");
  });

  it("web: subscribed here or reached elsewhere only hears about the switches", () => {
    expect(pickAlertsMode(web({ perm: "granted", subscribed: true }), true)).toBe("partial");
    expect(pickAlertsMode(web({ perm: "granted", subscribed: true }), false)).toBeNull();
    expect(pickAlertsMode(web({ pushElsewhere: true }), false)).toBeNull();
    expect(pickAlertsMode(web({ pushElsewhere: true }), true)).toBe("partial");
    expect(pickAlertsMode(web({ perm: "denied", pushElsewhere: true }), true)).toBe("partial");
  });
});

describe("latestPaymentTo", () => {
  const ME = "me";
  const expenses = [
    { id: "e1", paid_by: ME },
    { id: "e2", paid_by: ME },
    { id: "e3", paid_by: "sam" },
  ];
  const split = (over: Partial<{ expense_id: string; user_id: string; amount_owed: number | string; status: string; paid_at: string | null }>) => ({
    expense_id: "e1",
    user_id: "sam",
    amount_owed: 10,
    status: "paid",
    paid_at: hoursAgo(3),
    ...over,
  });

  it("adds up the shares one person cleared in one go", () => {
    const at = daysAgo(3);
    const ev = latestPaymentTo(
      ME,
      expenses,
      [split({ paid_at: at, amount_owed: "12.50" }), split({ expense_id: "e2", paid_at: at, amount_owed: 12 })],
      [],
      NOW,
    );
    expect(ev).toEqual({ from: "sam", at, amount: 24.5 });
  });

  it("only counts payments to me, made by someone else, in the last fortnight", () => {
    const ignored = [
      split({ user_id: ME, status: "confirmed" }), // my own share
      split({ status: "unpaid", paid_at: null }), // not paid
      split({ status: "confirmed", paid_at: null }), // swept, never claimed
      split({ expense_id: "e3", user_id: "priya" }), // Sam's expense, not mine
      split({ paid_at: daysAgo(15) }), // too old
      split({ paid_at: new Date(NOW + 3_600_000).toISOString() }), // in the future
      split({ amount_owed: 0 }), // nothing
    ];
    expect(latestPaymentTo(ME, expenses, ignored, [], NOW)).toBeNull();
  });

  it("picks the latest across shares and settle-up payments", () => {
    const ev = latestPaymentTo(
      ME,
      expenses,
      [split({ paid_at: daysAgo(4) }), split({ user_id: "priya", status: "confirmed", paid_at: daysAgo(2) })],
      [
        { from_user: "alex", to_user: ME, amount: 30, created_at: daysAgo(1) },
        { from_user: ME, to_user: "alex", amount: 99, created_at: hoursAgo(1) }, // I paid, not them
        { from_user: "alex", to_user: "sam", amount: 99, created_at: hoursAgo(1) }, // not to me
      ],
      NOW,
    );
    expect(ev).toEqual({ from: "alex", at: daysAgo(1), amount: 30 });
  });
});

describe("paidWhen", () => {
  const now = new Date(NOW);
  it("says today and yesterday by the UK calendar", () => {
    expect(paidWhen("2026-10-02T08:00:00Z", now)).toBe("today");
    expect(paidWhen("2026-10-01T23:30:00Z", now)).toBe("today"); // 00:30 BST on the 2nd
    expect(paidWhen("2026-10-01T22:30:00Z", now)).toBe("yesterday"); // 23:30 BST on the 1st
  });

  it("names the weekday within the week, then the date", () => {
    expect(paidWhen("2026-09-29T10:00:00Z", now)).toBe("on Tuesday");
    expect(paidWhen("2026-09-26T10:00:00Z", now)).toBe("on Saturday");
    expect(paidWhen("2026-09-25T10:00:00Z", now)).toBe("on 25 Sept");
  });

  it("never prints a broken date", () => {
    expect(paidWhen("not a date", now)).toBe("recently");
  });
});

describe("describePayment", () => {
  const ev = { from: "sam", at: "2026-09-29T10:00:00Z", amount: 24.5 };
  it("uses their first name, the house's money format and the day", () => {
    expect(describePayment(ev, () => "Sam Carter", "GBP", new Date(NOW))).toEqual({
      name: "Sam",
      amount: "£24.50",
      when: "on Tuesday",
    });
  });

  it("falls back to a neutral word when they have no name", () => {
    expect(describePayment(ev, () => null, "GBP", new Date(NOW)).name).toBe("A housemate");
    expect(describePayment(ev, () => "  ", "GBP", new Date(NOW)).name).toBe("A housemate");
  });
});
