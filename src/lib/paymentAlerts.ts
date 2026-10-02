// The "Don't miss a payment" pop-up's rules, kept pure so they can be tested
// without a phone: who gets which version, how often, and the real payment it
// quotes as the reason. The pop-up itself is components/push/PaymentAlertsPrompt.

import { firstName, formatDate, formatMoney } from "@/lib/format";

export type PaymentAlertsMode = "off" | "partial" | "blocked";

/** At most once a fortnight, and at most three times per person per device. */
export const ALERTS_PROMPT_EVERY_MS = 14 * 24 * 60 * 60 * 1000;
export const ALERTS_PROMPT_MAX_SHOWS = 3;
/** The first week belongs to the launch-time notifications ask (PushPrimer). */
export const ALERTS_PROMPT_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A payment older than this is too stale to quote as the reason. */
export const RECENT_PAYMENT_MS = 14 * 24 * 60 * 60 * 1000;

/** Per person AND per device: it is this device's notifications that are off. */
export const alertsPromptKey = (userId: string) => `hs_alerts_prompt::${userId}`;
/** Device test switch: localStorage hs_test_alerts = "off" | "partial" | "blocked". */
export const ALERTS_TEST_KEY = "hs_test_alerts";

/** The account switches that decide whether a payment reaches them. */
export const PAYMENT_PUSH_TYPES = [
  { col: "notify_push_paid", label: "Payments to you" },
  { col: "notify_push_bill", label: "Bill requests" },
] as const;

/** Every push type, for "Turn them all on". Keep in step with NotificationsPanel. */
export const ALL_PUSH_COLUMNS = [
  "notify_push_message",
  "notify_push_expense",
  "notify_push_bill",
  "notify_push_paid",
  "notify_push_chore",
  "notify_push_member",
  "notify_push_away",
] as const;

/** Names of the payment switches turned off (a missing row or column means on). */
export function paymentTypesOff(settings: object | null | undefined): string[] {
  const s = (settings ?? {}) as Record<string, unknown>;
  return PAYMENT_PUSH_TYPES.filter((t) => s[t.col] === false).map((t) => t.label);
}

export type AlertsPromptRecord = { last: number; count: number };

export function parseAlertsRecord(raw: string | null): AlertsPromptRecord {
  if (!raw) return { last: 0, count: 0 };
  try {
    const v = JSON.parse(raw) as Partial<AlertsPromptRecord> | null;
    const last = Number(v?.last);
    const count = Number(v?.count);
    return {
      last: Number.isFinite(last) ? last : 0,
      count: Number.isFinite(count) ? count : 0,
    };
  } catch {
    // Unreadable: treat as used up rather than risk showing it on every visit.
    return { last: 0, count: ALERTS_PROMPT_MAX_SHOWS };
  }
}

export function alertsPromptDue(rec: AlertsPromptRecord, now: number): boolean {
  return rec.count < ALERTS_PROMPT_MAX_SHOWS && now - rec.last >= ALERTS_PROMPT_EVERY_MS;
}

export function nextAlertsRecord(rec: AlertsPromptRecord, now: number): AlertsPromptRecord {
  return { last: now, count: rec.count + 1 };
}

export type AlertsDevice =
  | {
      kind: "native";
      /** The OS permission. "prompt" covers Android's "ask again" state too. */
      perm: "granted" | "denied" | "prompt";
      /** hs_push: this install registered for push. */
      registered: boolean;
      /** hs_push_optout: turned off in Settings, or "Not now" twice on the first ask. */
      optedOut: boolean;
    }
  | {
      kind: "web";
      supported: boolean;
      perm: "granted" | "denied" | "default";
      subscribed: boolean;
      /** Push already reaches them on another device (the app, another browser). */
      pushElsewhere: boolean;
    };

/**
 * Which version of the pop-up this device should see, or null for none.
 *
 * Native: OS-blocked gets the steps to fix it; on with a payment switch off
 * gets "turn them all on"; off gets the ask only once they have opted out,
 * because until then the first-run ask (PushPrimer) owns them and two asks
 * would stack. Web: browsers that can't do notifications, or where they were
 * blocked, are left alone; someone already reached on another device only
 * hears about their switches.
 */
export function pickAlertsMode(device: AlertsDevice, paymentOff: boolean): PaymentAlertsMode | null {
  if (device.kind === "native") {
    if (device.perm === "denied") return "blocked";
    if (device.perm === "granted" && device.registered) return paymentOff ? "partial" : null;
    return device.optedOut ? "off" : null;
  }
  if (!device.supported) return null;
  if ((device.perm === "granted" && device.subscribed) || device.pushElsewhere) {
    return paymentOff ? "partial" : null;
  }
  if (device.perm === "denied") return null;
  return "off";
}

// ---------------------------------------------------------------------------
// The reason: the latest payment someone made them
// ---------------------------------------------------------------------------

export type PaymentEvent = { from: string; amount: number; at: string };

type ExpenseLite = { id: string; paid_by: string | null };
type SplitLite = {
  expense_id: string;
  user_id: string;
  amount_owed: number | string;
  status: string;
  paid_at: string | null;
};
type SettlementLite = {
  from_user: string;
  to_user: string;
  amount: number | string;
  created_at: string;
};

/**
 * The most recent payment made TO this person in the last fortnight: the same
 * moments that send the "Sam paid you £X" push. A claim covering several
 * shares (pay_itemised, mark-paid on a row) stamps them all with one paid_at,
 * so rows from one person at one instant add up to one payment. The person's
 * own shares, and anything with no paid_at (a settle-up sweep only sets
 * confirmed_at), are not payments to them.
 */
export function latestPaymentTo(
  userId: string,
  expenses: ExpenseLite[],
  splits: SplitLite[],
  settlements: SettlementLite[],
  now: number,
): PaymentEvent | null {
  const payerOf = new Map(expenses.map((e) => [e.id, e.paid_by]));
  const recent = (at: string) => {
    const t = Date.parse(at);
    // A little slack for clock skew between the phone that stamped it and here.
    return Number.isFinite(t) && t <= now + 5 * 60_000 && now - t <= RECENT_PAYMENT_MS;
  };

  const claims = new Map<string, PaymentEvent>();
  for (const s of splits) {
    if (s.user_id === userId || !s.paid_at) continue;
    if (s.status !== "paid" && s.status !== "confirmed") continue;
    if (payerOf.get(s.expense_id) !== userId) continue;
    if (!recent(s.paid_at)) continue;
    const key = `${s.user_id}|${s.paid_at}`;
    const prev = claims.get(key);
    const amount = Number(s.amount_owed) || 0;
    claims.set(key, { from: s.user_id, at: s.paid_at, amount: (prev?.amount ?? 0) + amount });
  }

  const events: PaymentEvent[] = [...claims.values()];
  for (const p of settlements) {
    if (p.to_user !== userId || p.from_user === userId) continue;
    if (!recent(p.created_at)) continue;
    events.push({ from: p.from_user, at: p.created_at, amount: Number(p.amount) || 0 });
  }

  let best: PaymentEvent | null = null;
  for (const ev of events) {
    if (ev.amount < 0.005) continue;
    if (!best || Date.parse(ev.at) > Date.parse(best.at)) best = ev;
  }
  return best;
}

const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** The UK calendar day of an instant, as a UTC midnight timestamp. */
function ukDay(d: Date): number {
  const iso = d.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
}

/** "today", "yesterday", "on Tuesday" (this past week), else "on 21 Sept". UK time. */
export function paidWhen(at: string, now: Date): string {
  const then = new Date(at);
  if (Number.isNaN(then.getTime())) return "recently";
  const day = ukDay(then);
  const days = Math.round((ukDay(now) - day) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `on ${WEEKDAYS_LONG[new Date(day).getUTCDay()]}`;
  return `on ${formatDate(at, { day: "numeric", month: "short" })}`;
}

/** A real, recent payment, worded for the pop-up ("Sam" paid you back "£24.50" "on Tuesday"). */
export type RecentPayment = { name: string; amount: string; when: string };

export function describePayment(
  ev: PaymentEvent,
  nameOf: (userId: string) => string | null | undefined,
  currency: string,
  now: Date,
): RecentPayment {
  const name = nameOf(ev.from)?.trim();
  return {
    // firstName(null) is "there", so no name means a neutral word instead.
    name: name ? firstName(name) : "A housemate",
    amount: formatMoney(ev.amount, currency),
    when: paidWhen(ev.at, now),
  };
}
