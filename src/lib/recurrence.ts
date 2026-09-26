// Date helpers for recurring bills and repeating chores.
//
// All maths is done in UTC. Parsing "yyyy-mm-dd" as local time (e.g.
// `new Date("2026-07-01T00:00:00")`) and then reading it back via toISOString()
// drifts the date by a day in any timezone ahead of UTC (e.g. UK during BST),
// which would silently shift bill due-dates. Building and reading the date in
// UTC keeps a calendar date a calendar date.

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a "yyyy-mm-dd" string into a UTC-midnight Date. */
function parseISODate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

/**
 * Advance a yyyy-mm-dd date by one period of the given frequency.
 * Supports both bill frequencies (weekly/monthly/quarterly/yearly) and chore
 * repeats (weekly/fortnightly/monthly).
 *
 * Month-based steps clamp to the target month's length instead of letting JS
 * Date overflow: 31 Oct + 1 month used to become 1 Dec, silently skipping
 * November's whole cycle. `anchorDay` (a bill's due_day) lets a clamped date
 * recover the intended day afterwards: 30 Nov with anchor 31 -> 31 Dec.
 */
export function advanceDate(dateStr: string, frequency: string, anchorDay?: number): string {
  const d = parseISODate(dateStr);
  const addMonths = (months: number): string => {
    const day =
      anchorDay && Number.isInteger(anchorDay) && anchorDay >= 1 && anchorDay <= 31
        ? anchorDay
        : d.getUTCDate();
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + months; // Date.UTC handles month overflow
    const daysInTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    return toISODate(new Date(Date.UTC(y, m, Math.min(day, daysInTarget))));
  };
  switch (frequency) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      return addMonths(1);
    case "quarterly":
      return addMonths(3);
    case "yearly":
      return addMonths(12);
    default:
      return dateStr; // "once" or unknown -> no change
  }
  return toISODate(d);
}

/**
 * Advance a date by whole periods until it lands AFTER today. Logging a bill
 * that's months overdue used to advance one period from the stale date and
 * leave the bill still "overdue" — this catches all the way up. Non-repeating
 * frequencies ("once"/unknown) return the input unchanged.
 */
export function advancePastToday(dateStr: string, frequency: string, anchorDay?: number): string {
  const today = todayISO();
  let next = advanceDate(dateStr, frequency, anchorDay);
  if (next === dateStr) return dateStr; // "once"/unknown — advanceDate is a no-op
  for (let i = 0; next <= today && i < 500; i++) {
    next = advanceDate(next, frequency, anchorDay);
  }
  return next;
}

/** A sensible default "next due" date for a brand-new bill of this frequency. */
export function defaultNextDue(frequency: string): string {
  const today = toISODate(new Date());
  return advanceDate(today, frequency);
}

/**
 * The next time a day-of-month (1-31) comes round: today if it's today,
 * otherwise the next occurrence, clamped to short months (31st -> 30 Sept).
 * Used when set-up turns "rent is due on the 5th" into a real monthly bill.
 */
export function nextDueForDay(day: number, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const clamped = (yy: number, mm: number) => {
    const daysInMonth = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(day, daysInMonth)));
  };
  const thisMonth = clamped(y, m);
  const todayUTC = Date.UTC(y, m, now.getUTCDate());
  return toISODate(thisMonth.getTime() >= todayUTC ? thisMonth : clamped(y, m + 1));
}

export function todayISO(): string {
  return toISODate(new Date());
}
