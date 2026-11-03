import { describe, expect, it } from "vitest";
import { checkHours, EditError } from "./site-edits";
import { validateProfile } from "./profile-form";

describe("checkHours", () => {
  it("accepts half-hour blocks and sorts them by day", () => {
    expect(checkHours([{ weekday: 3, startMin: 540, endMin: 1020 }, { weekday: 1, startMin: 360, endMin: 1260 }]).map((r) => r.weekday)).toEqual([1, 3]);
  });
  it("rejects off-grid times, end before start, repeated and unknown days", () => {
    expect(() => checkHours([{ weekday: 1, startMin: 545, endMin: 1020 }])).toThrow(EditError);
    expect(() => checkHours([{ weekday: 1, startMin: 1020, endMin: 540 }])).toThrow(/after the start/);
    expect(() => checkHours([{ weekday: 1, startMin: 540, endMin: 600 }, { weekday: 1, startMin: 660, endMin: 720 }])).toThrow(/twice/);
    expect(() => checkHours([{ weekday: 7, startMin: 540, endMin: 600 }])).toThrow(/Unknown weekday/);
  });
});

describe("validateProfile", () => {
  const base = { displayName: "Michelle", headline: "", bio: "", photoUrl: "", rate: 55, areas: ["Burnaby"], serviceIds: ["s1"] };
  it("converts dollars to cents", () => {
    const r = validateProfile({ ...base, nightlyRate: 120 }, true);
    expect("value" in r && r.value.hourlyRateCents).toBe(5500);
    expect("value" in r && r.value.nightlyRateCents).toBe(12000);
  });
  it("leaves the nightly rate alone when undefined, clears it when null", () => {
    const keep = validateProfile(base, true);
    expect("value" in keep && keep.value.nightlyRateCents).toBeUndefined();
    const clear = validateProfile({ ...base, nightlyRate: null }, true);
    expect("value" in clear && clear.value.nightlyRateCents).toBeNull();
  });
  it("rejects out-of-range rates and non-https photos", () => {
    expect(validateProfile({ ...base, rate: 10 })).toEqual({ error: expect.stringMatching(/hourly rate/) });
    expect(validateProfile({ ...base, photoUrl: "http://x.example/p.jpg" })).toEqual({ error: expect.stringMatching(/https/) });
  });
});
