import { describe, it, expect } from "vitest";
import {
  billActionableToday,
  billSchedule,
  chaseTargets,
  displayDue,
  nudgeAfterDaysFor,
  overdueOnSave,
  planPortionedCycles,
} from "./billEngine";

const TODAY = "2026-09-27";

describe("billSchedule", () => {
  it("sorts picked days earliest-first and dedupes", () => {
    expect(billSchedule(true, [0, 3, 3])).toEqual({
      remindersOn: true,
      leads: [3, 0],
      createLead: 3,
      laterLeads: [0],
    });
  });

  it("reminders off or no days picked still bills, silently, on the due day", () => {
    const off = { remindersOn: false, leads: [], createLead: 0, laterLeads: [] };
    expect(billSchedule(false, [7, 3])).toEqual(off);
    expect(billSchedule(true, [])).toEqual(off);
  });
});

describe("planPortionedCycles", () => {
  it("monthly: creates on the first reminder day and moves one period on", () => {
    const p = planPortionedCycles("2026-09-30", "monthly", 30, TODAY, 3);
    expect(p.creates).toEqual([{ due: "2026-09-30", next: "2026-10-30", daysToDue: 3 }]);
    expect(p.finalNext).toBe("2026-10-30");
    expect(p.skippedCount).toBe(0);
  });

  it("monthly: nothing before the creation day", () => {
    const p = planPortionedCycles("2026-10-02", "monthly", 2, TODAY, 3);
    expect(p.creates).toEqual([]);
    expect(p.finalNext).toBe("2026-10-02");
  });

  it("weekly with a 7-day lead creates exactly one cycle, a week ahead", () => {
    const p = planPortionedCycles("2026-10-04", "weekly", undefined, TODAY, 7);
    expect(p.creates.map((c) => c.due)).toEqual(["2026-10-04"]);
    expect(p.finalNext).toBe("2026-10-11");
  });

  it("weekly after an outage: skips what's too old, keeps the one inside the window", () => {
    const p = planPortionedCycles("2026-09-18", "weekly", undefined, TODAY, 3);
    expect(p.skippedCount).toBe(1);
    expect(p.skippedFirst).toBe("2026-09-18");
    expect(p.creates).toEqual([{ due: "2026-09-25", next: "2026-10-02", daysToDue: -2 }]);
    expect(p.finalNext).toBe("2026-10-02");
  });

  it("weekly outage with a 7-day lead also creates the next one whose day has come", () => {
    const p = planPortionedCycles("2026-09-18", "weekly", undefined, TODAY, 7);
    expect(p.creates.map((c) => c.due)).toEqual(["2026-09-25", "2026-10-02"]);
    expect(p.finalNext).toBe("2026-10-09");
  });

  it("a week late is still created; eight days is skipped", () => {
    expect(planPortionedCycles("2026-09-20", "monthly", 20, TODAY, 3).creates.map((c) => c.due)).toEqual([
      "2026-09-20",
    ]);
    const p = planPortionedCycles("2026-09-19", "monthly", 19, TODAY, 3);
    expect(p.creates).toEqual([]);
    expect(p.skippedCount).toBe(1);
    expect(p.finalNext).toBe("2026-10-19");
  });

  it("far behind: never conjures ancient debts", () => {
    const p = planPortionedCycles("2026-06-18", "monthly", 18, TODAY, 3);
    expect(p.creates).toEqual([]);
    expect(p.skippedCount).toBe(4); // 18 Jun, 18 Jul, 18 Aug, 18 Sept
    expect(p.finalNext).toBe("2026-10-18");
  });

  it("keeps a 31st anchor through short months", () => {
    const p = planPortionedCycles("2026-10-31", "monthly", 31, "2026-10-28", 3);
    expect(p.creates).toEqual([{ due: "2026-10-31", next: "2026-11-30", daysToDue: 3 }]);
    const nov = planPortionedCycles("2026-11-30", "monthly", 31, "2026-11-27", 3);
    expect(nov.creates[0].next).toBe("2026-12-31");
  });
});

describe("nudgeAfterDaysFor", () => {
  it("lands a week after people were told, even for a late cycle", () => {
    expect(nudgeAfterDaysFor(3)).toBe(7);
    expect(nudgeAfterDaysFor(0)).toBe(7);
    expect(nudgeAfterDaysFor(-1)).toBe(8);
    expect(nudgeAfterDaysFor(-7)).toBe(14);
  });
});

describe("chaseTargets", () => {
  const cycles = [{ date: "2026-09-27" }, { date: "2026-09-30" }, { date: "2026-09-26" }];
  it("matches only pending cycles on a later reminder day", () => {
    expect(chaseTargets(cycles, [0], TODAY)).toEqual([{ date: "2026-09-27" }]);
    expect(chaseTargets(cycles, [3, 0], TODAY)).toEqual([{ date: "2026-09-27" }, { date: "2026-09-30" }]);
    expect(chaseTargets(cycles, [], TODAY)).toEqual([]);
  });
});

describe("billActionableToday", () => {
  const portions = [
    { user_id: "a", share_type: "percent" as const, value: 50 },
    { user_id: "b", share_type: "percent" as const, value: 50 },
  ];
  const sched = billSchedule(true, [3, 0]);

  it("manual bills only on their reminder days or the overdue shot", () => {
    const base = { today: TODAY, schedule: sched, portions: [], amount: 100, autoCycleDates: [] };
    expect(billActionableToday({ ...base, nextDue: "2026-09-30" })).toBe(true);
    expect(billActionableToday({ ...base, nextDue: "2026-09-25" })).toBe(true);
    expect(billActionableToday({ ...base, nextDue: "2026-09-29" })).toBe(false);
  });

  it("portioned bills from their creation day, and on chase days", () => {
    const base = { today: TODAY, schedule: sched, portions, amount: 100, autoCycleDates: [] };
    expect(billActionableToday({ ...base, nextDue: "2026-09-29" })).toBe(true);
    expect(billActionableToday({ ...base, nextDue: "2026-10-20" })).toBe(false);
    expect(
      billActionableToday({ ...base, nextDue: "2026-10-27", autoCycleDates: ["2026-09-27"] }),
    ).toBe(true);
  });

  it("a broken set can't create, so it only wakes on schedule days", () => {
    const broken = [{ user_id: "a", share_type: "percent" as const, value: 60 }];
    const base = { today: TODAY, schedule: sched, portions: broken, amount: 100, autoCycleDates: [] };
    expect(billActionableToday({ ...base, nextDue: "2026-09-29" })).toBe(false);
    expect(billActionableToday({ ...base, nextDue: "2026-09-30" })).toBe(true);
  });

  it("reminders off: a broken set still wakes once, on the due day, to warn the payer", () => {
    const broken = [{ user_id: "a", share_type: "percent" as const, value: 60 }];
    const off = billSchedule(false, [3, 0]);
    const base = { today: TODAY, schedule: off, portions: broken, amount: 100, autoCycleDates: [] };
    expect(billActionableToday({ ...base, nextDue: "2026-09-27" })).toBe(true);
    expect(billActionableToday({ ...base, nextDue: "2026-09-28" })).toBe(false);
    expect(billActionableToday({ ...base, nextDue: "2026-09-26" })).toBe(false);
  });
});

describe("displayDue", () => {
  it("shows the engine cycle still ahead, else the next due date", () => {
    expect(displayDue("2026-11-01", ["2026-10-01"], TODAY)).toEqual({ due: "2026-10-01", pending: "2026-10-01" });
    expect(displayDue("2026-11-01", ["2026-09-01"], TODAY)).toEqual({ due: "2026-11-01", pending: null });
    expect(displayDue("2026-11-01", [], TODAY)).toEqual({ due: "2026-11-01", pending: null });
    expect(displayDue(null, ["2026-10-08", "2026-10-01"], TODAY)).toEqual({ due: "2026-10-01", pending: "2026-10-01" });
  });
});

describe("overdueOnSave", () => {
  it("nothing to say when the due date hasn't passed", () => {
    expect(overdueOnSave(null, "monthly", 1, TODAY)).toEqual({ kind: "none" });
    expect(overdueOnSave("2026-09-27", "monthly", 27, TODAY)).toEqual({ kind: "none" });
  });

  it("recent: left for the engine to send late", () => {
    expect(overdueOnSave("2026-09-22", "monthly", 22, TODAY)).toEqual({
      kind: "sendsLate",
      due: "2026-09-22",
      daysLate: 5,
    });
  });

  it("older: the save moves the schedule on, and that one is never sent", () => {
    expect(overdueOnSave("2026-09-17", "monthly", 17, TODAY)).toEqual({
      kind: "skip",
      due: "2026-09-17",
      daysLate: 10,
      rollTo: "2026-10-17",
    });
  });

  it("weekly: rolls only as far as the first occurrence the engine can still send", () => {
    expect(overdueOnSave("2026-09-19", "weekly", undefined, TODAY)).toEqual({
      kind: "skip",
      due: "2026-09-19",
      daysLate: 8,
      rollTo: "2026-09-26",
    });
  });
});
