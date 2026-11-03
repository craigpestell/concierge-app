import { describe, expect, it } from "vitest";
import { bearerMatches } from "./bearer";

describe("bearerMatches", () => {
  it("accepts the exact secret", () => expect(bearerMatches("Bearer s3cret", "s3cret")).toBe(true));
  it("rejects a wrong or missing header", () => {
    expect(bearerMatches("Bearer nope", "s3cret")).toBe(false);
    expect(bearerMatches("s3cret", "s3cret")).toBe(false);
    expect(bearerMatches(null, "s3cret")).toBe(false);
  });
  it("rejects everything when no secret is set", () => expect(bearerMatches("Bearer ", undefined)).toBe(false));
});
