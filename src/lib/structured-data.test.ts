import { describe, expect, it } from "vitest";
import { businessJsonLd, jsonLdScript } from "./structured-data";

describe("businessJsonLd", () => {
  it("names the service area and hourly rate", () => {
    const d = businessJsonLd({ phone: "604-555-1234", rateCents: 5000, services: ["House sitting"] });
    expect(d["@type"]).toBe("LocalBusiness");
    expect(d.areaServed.map((a) => a.name)).toEqual(["New Westminster", "Burnaby"]);
    expect(d.telephone).toBe("604-555-1234");
    expect(d.makesOffer?.[0]?.priceSpecification.price).toBe("50.00");
  });

  it("leaves out a missing phone and rate", () => {
    const d = businessJsonLd({ phone: null, rateCents: null, services: [] });
    expect("telephone" in d).toBe(false);
    expect("makesOffer" in d).toBe(false);
  });
});

describe("jsonLdScript", () => {
  it("can't close the script tag", () => {
    expect(jsonLdScript({ a: "</script><b>" })).not.toContain("</script>");
  });
});
