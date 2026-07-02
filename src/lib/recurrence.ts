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
 */
export function advanceDate(dateStr: string, frequency: string): string {
  const d = parseISODate(dateStr);
  switch (frequency) {
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      return dateStr; // "once" or unknown -> no change
  }
  return toISODate(d);
}

/** A sensible default "next due" date for a brand-new bill of this frequency. */
export function defaultNextDue(frequency: string): string {
  const today = toISODate(new Date());
  return advanceDate(today, frequency);
}

export function todayISO(): string {
  return toISODate(new Date());
}
