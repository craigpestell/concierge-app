import { describe, expect, it } from "vitest";
import { openStarts, isOpen } from "./slots";
import { localDate, zonedToInstant, weekdayOf, addDays } from "./time";

const TZ = "America/Vancouver";
const nineToFive = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));
const base = { weekly: nineToFive, busy: [], timeZone: TZ, minLeadHours: 0, now: new Date("2026-01-01T00:00:00Z") };

describe("time helpers", () => {
  it("converts Vancouver wall time to UTC in winter and summer", () => {
    expect(zonedToInstant("2026-01-15", 9 * 60, TZ).toISOString()).toBe("2026-01-15T17:00:00.000Z");
    expect(zonedToInstant("2026-07-15", 9 * 60, TZ).toISOString()).toBe("2026-07-15T16:00:00.000Z");
  });

  it("finds the local date of an instant", () => {
    expect(localDate(new Date("2026-01-16T05:00:00Z"), TZ)).toBe("2026-01-15");
  });

  it("knows weekdays and month ends", () => {
    expect(weekdayOf("2026-10-02")).toBe(5);
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
  });
});

describe("openStarts", () => {
  it("lists hourly starts that fit the whole booking inside working hours", () => {
    const starts = openStarts({ ...base, date: "2026-01-15", hours: 2 });
    expect(starts.map((s) => s.toISOString())).toEqual(
      [9, 10, 11, 12, 13, 14, 15].map((h) => `2026-01-15T${String(h + 8).padStart(2, "0")}:00:00.000Z`),
    );
  });

  it("returns nothing on a day off", () => {
    expect(openStarts({ ...base, date: "2026-01-18", hours: 1 })).toEqual([]);
  });

  it("skips times that overlap a booking or time off", () => {
    const busy = [
      { start: zonedToInstant("2026-01-15", 11 * 60, TZ), end: zonedToInstant("2026-01-15", 13 * 60, TZ) },
    ];
    const starts = openStarts({ ...base, busy, date: "2026-01-15", hours: 2 }).map((s) => s.toISOString());
    expect(starts).toEqual(["2026-01-15T17:00:00.000Z", "2026-01-15T21:00:00.000Z", "2026-01-15T22:00:00.000Z", "2026-01-15T23:00:00.000Z"]);
  });

  it("respects the minimum lead time", () => {
    const now = zonedToInstant("2026-01-15", 8 * 60, TZ);
    const starts = openStarts({ ...base, now, minLeadHours: 4, date: "2026-01-15", hours: 1 });
    expect(starts[0].toISOString()).toBe(zonedToInstant("2026-01-15", 12 * 60, TZ).toISOString());
  });

  it("handles the day clocks spring forward", () => {
    const weekly = [{ weekday: 0, startMin: 9 * 60, endMin: 12 * 60 }];
    const starts = openStarts({ ...base, weekly, date: "2026-03-08", hours: 1 });
    expect(starts.map((s) => s.toISOString())).toEqual([
      "2026-03-08T16:00:00.000Z",
      "2026-03-08T17:00:00.000Z",
      "2026-03-08T18:00:00.000Z",
    ]);
  });

  it("re-checks a single start", () => {
    const input = { ...base, date: "2026-01-15", hours: 1 };
    expect(isOpen(input, zonedToInstant("2026-01-15", 9 * 60, TZ))).toBe(true);
    expect(isOpen(input, zonedToInstant("2026-01-15", 17 * 60, TZ))).toBe(false);
  });
});
