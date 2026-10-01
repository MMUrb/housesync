import type { PushPayload } from "@/lib/push";
import { formatMoney } from "@/lib/format";

// What the "while you're away" push says, picked from what happened in the
// person's house (kept apart from the sending so it can be unit tested).

const TAG = "hs-away";

/** The [start, end) last_active_at window that is exactly `days` old on the UTC day of `now`. */
export function awayWindow(days: number, now: number): { start: string; end: string } {
  const day = (offset: number) => new Date(now - offset * 86_400_000).toISOString().slice(0, 10);
  return { start: `${day(days)}T00:00:00Z`, end: `${day(days - 1)}T00:00:00Z` };
}

export type AwayState = {
  houseName: string;
  currency: string;
  /** What the others added since this person was last in, biggest first (null: no name set). */
  expensesBy: { name: string | null; count: number }[];
  messagesBy: { name: string | null; count: number }[];
  /** This person's net in the house: negative means they owe. */
  net: number;
  /** The other member's first name, when the house has exactly two. */
  onlyOther: string | null;
  memberCount: number;
  addedThisMonth: number;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const who = (list: { name: string | null }[], start: boolean) => {
  if (list.length > 1) return start ? "Your housemates" : "your housemates";
  return list[0].name ?? (start ? "A housemate" : "a housemate");
};

/** The push for one person, picked from what happened in their house. */
export function composeAwayPush(s: AwayState): PushPayload {
  const waiting = `${s.houseName} is waiting for you`;

  const clauses: string[] = [];
  const expenses = s.expensesBy.reduce((t, x) => t + x.count, 0);
  if (expenses > 0) clauses.push(`${who(s.expensesBy, true)} added ${plural(expenses, "expense")}`);
  const messages = s.messagesBy.reduce((t, x) => t + x.count, 0);
  if (messages > 0) {
    clauses.push(`${who(s.messagesBy, clauses.length === 0)} sent ${plural(messages, "message")}`);
  }
  if (clauses.length > 0) {
    return {
      title: waiting,
      body: `${clauses.join(" and ")} since you were last in. Tap to catch up.`,
      url: "/dashboard",
      tag: TAG,
    };
  }

  if (s.net <= -0.5) {
    const amount = formatMoney(-s.net, s.currency);
    return {
      title: waiting,
      body: `You still owe ${s.onlyOther ? `${s.onlyOther} ` : ""}${amount}. Settle up in a couple of taps.`,
      url: "/housemates",
      tag: TAG,
    };
  }
  if (s.net >= 0.5) {
    const amount = formatMoney(s.net, s.currency);
    return {
      title: waiting,
      body: s.onlyOther
        ? `${s.onlyOther} still owes you ${amount}. Tap to see where things stand.`
        : `You're still owed ${amount}. Tap to see where things stand.`,
      url: "/housemates",
      tag: TAG,
    };
  }

  if (s.memberCount <= 1) {
    return {
      title: `Start tracking ${s.houseName}`,
      body: "Invite your housemates and HouseSync splits the bills between you.",
      url: "/housemates",
      tag: TAG,
    };
  }
  return {
    title: `Start tracking ${s.houseName}`,
    body: `${s.addedThisMonth === 0 ? "Nothing's been added this month. " : ""}Add the bills and HouseSync reminds everyone when they're due.`,
    url: "/bills/new",
    tag: TAG,
  };
}
