// Date helpers for recurring bills and repeating chores.

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Advance a yyyy-mm-dd date by one period of the given frequency.
 * Supports both bill frequencies (weekly/monthly/quarterly/yearly) and chore
 * repeats (weekly/fortnightly/monthly).
 */
export function advanceDate(dateStr: string, frequency: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  switch (frequency) {
    case "weekly":
      d.setDate(d.getDate() + 7);
      break;
    case "fortnightly":
      d.setDate(d.getDate() + 14);
      break;
    case "monthly":
      d.setMonth(d.getMonth() + 1);
      break;
    case "quarterly":
      d.setMonth(d.getMonth() + 3);
      break;
    case "yearly":
      d.setFullYear(d.getFullYear() + 1);
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
