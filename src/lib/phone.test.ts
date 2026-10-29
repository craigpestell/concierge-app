import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, providerGuide, telHref } from "./phone";

describe("normalizePhone", () => {
  it("accepts common formats", () => {
    expect(normalizePhone("604-555-0142")).toBe("6045550142");
    expect(normalizePhone("(778) 555 0142")).toBe("7785550142");
    expect(normalizePhone("+1 236.555.0142")).toBe("2365550142");
  });

  it("rejects numbers that can't be dialled", () => {
    expect(normalizePhone("555-0142")).toBeNull();
    expect(normalizePhone("104-555-0142")).toBeNull();
    expect(normalizePhone("604-155-0142")).toBeNull();
    expect(normalizePhone("2-604-555-0142")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("display helpers", () => {
  it("formats and links a saved number", () => {
    expect(formatPhone("6045550142")).toBe("604-555-0142");
    expect(telHref("604-555-0142")).toBe("tel:+16045550142");
  });

  it("finds a provider guide by id", () => {
    expect(providerGuide("fongo")?.name).toBe("Fongo Works");
    expect(providerGuide("skype")).toBeUndefined();
  });
});
