// The recurring-bill engine's decisions, as pure functions so every date and
// frequency case is unit-tested. The cron (api/cron/reminders) does the I/O;
// cycle creation itself happens in the create_bill_cycle database function,
// which locks the bill and compare-and-swaps next_due_date, so whatever these
// plans say, a due date can only ever produce one cycle.

import { addDaysISO, advanceDate, daysBetweenISO, firstOnOrAfter } from "@/lib/recurrence";
import { portionsValid, type PortionRow } from "@/lib/billPortions";

/** How late the engine still creates a portioned cycle (cron outage cover). */
export const LATE_CREATE_DAYS = 7;

/**
 * How late an overdue cycle may be when portions are saved and still be left
 * for the engine to send. Kept inside LATE_CREATE_DAYS with a margin, so a
 * save just before or after the morning run can't flip the outcome.
 */
export const EDITOR_KEEP_OVERDUE_DAYS = 5;

/** The day the manual flow sends its one overdue push (days after due). */
export const OVERDUE_SHOT_DAYS = 2;

export type BillSchedule = {
  /** Reminders switched on AND at least one day picked. */
  remindersOn: boolean;
  /** Picked days before the due date, earliest first (e.g. [3, 0]). */
  leads: number[];
  /** When a portioned cycle is created. Due day itself when reminders are off. */
  createLead: number;
  /** Days that chase unpaid shares (every picked day after the first). */
  laterLeads: number[];
};

/**
 * Reminders only decide who hears about a bill, never whether a portioned
 * bill bills people: with reminders off or no days picked, the cycle is still
 * created, silently, on the due date.
 */
export function billSchedule(
  reminderEnabled: boolean,
  reminderDays: readonly number[] | null | undefined,
): BillSchedule {
  const picked = Array.isArray(reminderDays)
    ? [...new Set(reminderDays.filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => b - a)
    : [3, 0];
  const remindersOn = reminderEnabled && picked.length > 0;
  return {
    remindersOn,
    leads: remindersOn ? picked : [],
    createLead: remindersOn ? picked[0] : 0,
    laterLeads: remindersOn ? picked.slice(1) : [],
  };
}

export type CyclePlan = {
  /** Occurrences more than LATE_CREATE_DAYS old that are stepped over, never created. */
  skippedCount: number;
  /** The earliest skipped occurrence (for the heads-up to the payer). */
  skippedFirst: string | null;
  /** Cycles to create, in order. Each moves next_due_date on to `next`. */
  creates: { due: string; next: string; daysToDue: number }[];
  /** next_due_date once the whole plan has run. */
  finalNext: string;
};

/**
 * What a portioned bill should do today. Every occurrence whose creation day
 * has arrived (daysToDue <= createLead) and that is at most LATE_CREATE_DAYS
 * old is created, oldest first; older ones are skipped rather than turned
 * into surprise debts. Advancing one period at a time (not "past today")
 * means a weekly bill never loses an occurrence that falls inside the window.
 */
export function planPortionedCycles(
  nextDue: string,
  frequency: string,
  anchorDay: number | undefined,
  today: string,
  createLead: number,
): CyclePlan {
  const floor = addDaysISO(today, -LATE_CREATE_DAYS);
  let cur = nextDue;
  let skippedCount = 0;
  let skippedFirst: string | null = null;
  for (let i = 0; cur < floor && i < 1000; i++) {
    const next = advanceDate(cur, frequency, anchorDay);
    if (next === cur) break; // non-repeating: nothing to step to
    skippedFirst ??= cur;
    skippedCount++;
    cur = next;
  }

  const creates: CyclePlan["creates"] = [];
  for (let i = 0; i < 60 && cur >= floor; i++) {
    const daysToDue = daysBetweenISO(today, cur);
    if (daysToDue > createLead) break;
    const next = advanceDate(cur, frequency, anchorDay);
    if (next === cur) break;
    creates.push({ due: cur, next, daysToDue });
    cur = next;
  }

  return { skippedCount, skippedFirst, creates, finalNext: cur };
}

/**
 * The quiet unpaid-share nudge lands a week after people were told. A cycle
 * created late (after an outage) is dated on its due date, so its delay is
 * stretched by how late it is; otherwise the nudge would fire at once, or
 * never (the nudges run before the bill engine each morning).
 */
export function nudgeAfterDaysFor(daysToDue: number): number {
  return daysToDue < 0 ? Math.min(60, 7 - daysToDue) : 7;
}

/** Engine cycles (auto) that a later reminder day chases today. */
export function chaseTargets<T extends { date: string }>(
  autoCycles: readonly T[],
  laterLeads: readonly number[],
  today: string,
): T[] {
  if (laterLeads.length === 0) return [];
  const days = new Set(laterLeads.map((l) => addDaysISO(today, l)));
  return autoCycles.filter((c) => c.date >= today && days.has(c.date));
}

/**
 * Cheap pre-filter run over every bill before any house data is fetched, so
 * the daily run only fans out to houses with something to do. Errs towards
 * true: the per-bill logic makes the real decisions.
 */
export function billActionableToday(args: {
  nextDue: string;
  today: string;
  schedule: BillSchedule;
  portions: readonly PortionRow[];
  amount: number;
  autoCycleDates: readonly string[];
}): boolean {
  const { nextDue, today, schedule, portions, amount, autoCycleDates } = args;
  const d = daysBetweenISO(today, nextDue);
  if (schedule.remindersOn && (schedule.leads.includes(d) || d === -OVERDUE_SHOT_DAYS)) return true;
  if (portions.length === 0) return false;
  // The creation day itself, even for a broken set: with reminders off it's
  // the one day the payer is warned the sends are paused.
  if (d === schedule.createLead) return true;
  // Could create (or needs catching up) only if the set is complete on its own terms.
  const wellFormed = portionsValid(portions, amount, portions.map((p) => p.user_id));
  if (wellFormed && d <= schedule.createLead) return true;
  return chaseTargets(autoCycleDates.map((date) => ({ date })), schedule.laterLeads, today).length > 0;
}

/**
 * The due date people should see for a bill: the engine cycle they're paying
 * now when one is still ahead (next_due_date has already moved on to the
 * next period), otherwise next_due_date. One rule for the card, the details
 * sheet and the dashboard, so they never disagree.
 */
export function displayDue(
  nextDue: string | null,
  autoCycleDues: readonly string[],
  today: string,
): { due: string | null; pending: string | null } {
  const pending = autoCycleDues.filter((d) => d >= today).sort()[0] ?? null;
  return { due: pending ?? nextDue, pending };
}

export type OverdueOnSave =
  | { kind: "none" }
  /** Overdue but recent: left for the engine, which sends it on its next run. */
  | { kind: "sendsLate"; due: string; daysLate: number }
  /** Too overdue: saving moves next_due_date on to `rollTo`; `due` is never sent. */
  | { kind: "skip"; due: string; daysLate: number; rollTo: string };

/**
 * What saving portions does to a bill whose due date has already passed.
 * Deterministic whatever time of day the save happens: anything more than
 * EDITOR_KEEP_OVERDUE_DAYS late is rolled forward by the save itself, so the
 * engine's wider LATE_CREATE_DAYS window can never pick it up by surprise.
 */
export function overdueOnSave(
  nextDue: string | null,
  frequency: string,
  anchorDay: number | undefined,
  today: string,
): OverdueOnSave {
  if (!nextDue || nextDue >= today) return { kind: "none" };
  const daysLate = daysBetweenISO(nextDue, today);
  const keepFloor = addDaysISO(today, -EDITOR_KEEP_OVERDUE_DAYS);
  if (nextDue >= keepFloor) return { kind: "sendsLate", due: nextDue, daysLate };
  return {
    kind: "skip",
    due: nextDue,
    daysLate,
    rollTo: firstOnOrAfter(nextDue, frequency, keepFloor, anchorDay),
  };
}
