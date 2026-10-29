import { describe, expect, it } from "vitest";
import { eventForClick, measurementId } from "./analytics";

describe("eventForClick", () => {
  it("reads the event name and params from data attributes", () => {
    expect(eventForClick({ href: "/#book", dataset: { track: "cta_click", trackCta: "book_a_time", trackLocation: "header" } })).toEqual({
      name: "cta_click",
      params: { cta: "book_a_time", location: "header" },
    });
  });

  it("tracks phone and email links without attributes", () => {
    expect(eventForClick({ href: "tel:+16045550142", dataset: { trackLocation: "contact" } })).toEqual({
      name: "contact_click",
      params: { method: "phone", location: "contact" },
    });
    expect(eventForClick({ href: "mailto:hello@example.com", dataset: {} })?.params).toEqual({ method: "email" });
  });

  it("ignores other links", () => {
    expect(eventForClick({ href: "/account", dataset: {} })).toBeNull();
  });
});

describe("measurementId", () => {
  it("uses the brand default in production", () => {
    expect(measurementId({ NODE_ENV: "production" })).toMatch(/^G-/);
  });

  it("lets the env var override or turn it off", () => {
    expect(measurementId({ NODE_ENV: "production", GA_MEASUREMENT_ID: "G-TEST123" })).toBe("G-TEST123");
    expect(measurementId({ NODE_ENV: "production", GA_MEASUREMENT_ID: "off" })).toBeNull();
  });

  it("stays off in development", () => {
    expect(measurementId({ NODE_ENV: "development" })).toBeNull();
  });
});
