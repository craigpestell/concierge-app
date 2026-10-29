import { describe, expect, it } from "vitest";
import { nightsBetween, stayBlockedDates, stayInterval, stayIsOpen } from "./slots";
import { zonedToInstant } from "./time";
import { validateBookingRequest, BookingError } from "./bookings";
import { bookingWhen } from "./format";
import { features } from "./features";

const TZ = "America/Vancouver";

describe("stays", () => {
  it("counts nights across month ends", () => {
    expect(nightsBetween("2026-11-03", "2026-11-12")).toBe(9);
    expect(nightsBetween("2026-10-30", "2026-11-02")).toBe(3);
    expect(nightsBetween("2026-11-03", "2026-11-03")).toBe(0);
  });

  it("covers every day from local midnight to local midnight, across the clocks changing", () => {
    const s = stayInterval("2026-10-31", "2026-11-02", TZ);
    expect(s.start.toISOString()).toBe("2026-10-31T07:00:00.000Z");
    expect(s.end.toISOString()).toBe("2026-11-03T08:00:00.000Z");
  });

  it("blocks days with a booking or time off", () => {
    const busy = [
      { start: zonedToInstant("2026-11-05", 10 * 60, TZ), end: zonedToInstant("2026-11-05", 12 * 60, TZ) },
      stayInterval("2026-11-08", "2026-11-09", TZ),
    ];
    expect(stayBlockedDates("2026-11-04", "2026-11-10", busy, TZ)).toEqual(["2026-11-05", "2026-11-08", "2026-11-09"]);
    expect(stayIsOpen("2026-11-06", "2026-11-07", busy, TZ)).toBe(true);
    expect(stayIsOpen("2026-11-04", "2026-11-06", busy, TZ)).toBe(false);
    expect(stayIsOpen("2026-11-07", "2026-11-08", busy, TZ)).toBe(false);
    expect(stayIsOpen("2026-11-10", "2026-11-12", busy, TZ)).toBe(true);
  });

  it("labels a stay by its first and last days", () => {
    const s = stayInterval("2026-11-03", "2026-11-12", TZ);
    expect(bookingWhen({ kind: "STAY", ...s, nights: 9 })).toBe("Tuesday, November 3 to Thursday, November 12 (9 nights)");
  });
});

describe("validateBookingRequest", () => {
  const contact = { conciergeSlug: "michelle", serviceSlug: "pets-plants", name: "Sam", email: "sam@example.com", address: "1 Main St" };

  it("reads a stay", () => {
    expect(validateBookingRequest({ ...contact, kind: "stay", firstDay: "2026-11-03", lastDay: "2026-11-12" })).toMatchObject({
      kind: "stay",
      firstDay: "2026-11-03",
      lastDay: "2026-11-12",
    });
  });

  it("rejects stays with no nights or too many", () => {
    expect(() => validateBookingRequest({ ...contact, kind: "stay", firstDay: "2026-11-03", lastDay: "2026-11-03" })).toThrow(BookingError);
    expect(() => validateBookingRequest({ ...contact, kind: "stay", firstDay: "2026-11-01", lastDay: "2026-12-15" })).toThrow(/up to 30 nights/);
    expect(() => validateBookingRequest({ ...contact, kind: "stay", firstDay: "2026-11-31", lastDay: "2026-12-02" })).toThrow(BookingError);
  });

  it("still reads an hourly visit when no kind is sent", () => {
    expect(validateBookingRequest({ ...contact, start: "2026-11-03T17:00:00.000Z", hours: 2 })).toMatchObject({ kind: "visit", hours: 2 });
  });
});

describe("features", () => {
  it("keeps stays off unless the flag is on", () => {
    const before = process.env.FEATURE_STAYS;
    delete process.env.FEATURE_STAYS;
    expect(features.stays()).toBe(false);
    process.env.FEATURE_STAYS = "off";
    expect(features.stays()).toBe(false);
    process.env.FEATURE_STAYS = "on";
    expect(features.stays()).toBe(true);
    if (before === undefined) delete process.env.FEATURE_STAYS;
    else process.env.FEATURE_STAYS = before;
  });
});
