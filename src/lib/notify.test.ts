import { describe, expect, it } from "vitest";
import { cleanEvents, normalizeEmail, recipientsFor } from "./notify";

describe("notification recipients", () => {
  const rows = [
    { email: "michelle@example.com", events: ["booking", "stay", "cancelled", "done"] },
    { email: "Craig+rcc@example.com", events: ["stay", "cancelled"] },
  ];

  it("sends each event only to the addresses that want it", () => {
    expect(recipientsFor(rows, "booking")).toEqual(["michelle@example.com"]);
    expect(recipientsFor(rows, "stay")).toEqual(["michelle@example.com", "craig+rcc@example.com"]);
  });

  it("leaves out whoever caused the event", () => {
    expect(recipientsFor(rows, "cancelled", { exclude: "MICHELLE@example.com" })).toEqual(["craig+rcc@example.com"]);
  });

  it("falls back to her account email only when the list is empty", () => {
    expect(recipientsFor([], "booking", { fallback: "owner@example.com" })).toEqual(["owner@example.com"]);
    expect(recipientsFor([], "cancelled", { fallback: "owner@example.com", exclude: "owner@example.com" })).toEqual([]);
    expect(recipientsFor(rows, "booking", { fallback: "owner@example.com" })).toEqual(["michelle@example.com"]);
  });

  it("checks addresses and event keys", () => {
    expect(normalizeEmail("  Craig+RCC@Gmail.com ")).toBe("craig+rcc@gmail.com");
    expect(normalizeEmail("not an email")).toBeNull();
    expect(cleanEvents(["done", "bogus", "booking"])).toEqual(["booking", "done"]);
  });
});
