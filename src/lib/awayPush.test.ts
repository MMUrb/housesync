import { describe, expect, it } from "vitest";
import { awayWindow, composeAwayPush, type AwayState } from "./awayPush";

const base: AwayState = {
  houseName: "Elm Street",
  currency: "GBP",
  expensesBy: [],
  messagesBy: [],
  net: 0,
  onlyOther: null,
  memberCount: 3,
  addedThisMonth: 2,
};

describe("awayWindow", () => {
  it("covers exactly the UTC day N days ago", () => {
    const now = Date.parse("2026-10-08T08:00:00Z");
    expect(awayWindow(7, now)).toEqual({ start: "2026-10-01T00:00:00Z", end: "2026-10-02T00:00:00Z" });
    expect(awayWindow(21, now)).toEqual({ start: "2026-09-17T00:00:00Z", end: "2026-09-18T00:00:00Z" });
  });

  it("is the same window whatever time the job runs that day", () => {
    const early = awayWindow(7, Date.parse("2026-10-08T00:00:01Z"));
    const late = awayWindow(7, Date.parse("2026-10-08T23:59:59Z"));
    expect(early).toEqual(late);
  });

  it("consecutive days never overlap, so nobody matches twice", () => {
    const day1 = awayWindow(7, Date.parse("2026-10-08T08:00:00Z"));
    const day2 = awayWindow(7, Date.parse("2026-10-09T08:00:00Z"));
    expect(day1.end).toBe(day2.start);
  });
});

describe("composeAwayPush", () => {
  it("leads with what happened while they were away", () => {
    const p = composeAwayPush({
      ...base,
      expensesBy: [{ name: "Sam", count: 3 }],
      messagesBy: [{ name: "Priya", count: 4 }],
      net: -24.5,
    });
    expect(p.title).toBe("Elm Street is waiting for you");
    expect(p.body).toBe("Sam added 3 expenses and Priya sent 4 messages since you were last in. Tap to catch up.");
    expect(p.url).toBe("/dashboard");
    expect(p.tag).toBe("hs-away");
  });

  it("groups several people and keeps the grammar right", () => {
    expect(
      composeAwayPush({ ...base, messagesBy: [{ name: "Sam", count: 1 }, { name: "Priya", count: 2 }] }).body,
    ).toBe("Your housemates sent 3 messages since you were last in. Tap to catch up.");
    expect(
      composeAwayPush({
        ...base,
        expensesBy: [{ name: "Sam", count: 1 }],
        messagesBy: [{ name: "Sam", count: 1 }, { name: "Priya", count: 1 }],
      }).body,
    ).toBe("Sam added 1 expense and your housemates sent 2 messages since you were last in. Tap to catch up.");
    expect(composeAwayPush({ ...base, expensesBy: [{ name: null, count: 2 }] }).body).toBe(
      "A housemate added 2 expenses since you were last in. Tap to catch up.",
    );
  });

  it("then money still open, naming the other person only in a house of two", () => {
    expect(composeAwayPush({ ...base, net: -24.5, onlyOther: "Sam", memberCount: 2 }).body).toBe(
      "You still owe Sam £24.50. Settle up in a couple of taps.",
    );
    expect(composeAwayPush({ ...base, net: -24.5 }).body).toBe("You still owe £24.50. Settle up in a couple of taps.");
    expect(composeAwayPush({ ...base, net: 36, onlyOther: "Sam", memberCount: 2 }).body).toBe(
      "Sam still owes you £36.00. Tap to see where things stand.",
    );
    expect(composeAwayPush({ ...base, net: 36 }).url).toBe("/housemates");
  });

  it("ignores pennies of rounding", () => {
    expect(composeAwayPush({ ...base, net: -0.2 }).title).toBe("Start tracking Elm Street");
  });

  it("a quiet house is asked to start tracking, honestly", () => {
    expect(composeAwayPush({ ...base, addedThisMonth: 0 })).toEqual({
      title: "Start tracking Elm Street",
      body: "Nothing's been added this month. Add the bills and HouseSync reminds everyone when they're due.",
      url: "/bills/new",
      tag: "hs-away",
    });
    expect(composeAwayPush(base).body).toBe("Add the bills and HouseSync reminds everyone when they're due.");
  });

  it("someone on their own is pointed at inviting the others", () => {
    const p = composeAwayPush({ ...base, memberCount: 1 });
    expect(p.body).toBe("Invite your housemates and HouseSync splits the bills between you.");
    expect(p.url).toBe("/housemates");
  });
});
