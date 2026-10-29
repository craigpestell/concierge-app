import { describe, expect, it } from "vitest";
import { bookingCancelled, bookingConfirmed, ownerCancelled, renderEmail, type BookingEmailData } from "./email-templates";
import { reminderDue } from "./reminders";

const start = new Date("2026-11-10T18:00:00Z");
const visit: BookingEmailData = {
  kind: "VISIT",
  start,
  end: new Date("2026-11-10T20:00:00Z"),
  nights: null,
  address: "1 Main St",
  notes: "",
  priceCents: 10000,
  service: { name: "Errands & shopping" },
  customer: { name: "Jordan Lee", email: "jordan@example.com", phone: null },
  concierge: { displayName: "Michelle K", businessPhone: null },
};
const hoursBefore = (h: number) => new Date(start.getTime() - h * 3600_000);

describe("email templates", () => {
  it("builds matching text and html, escaping what clients typed", () => {
    const e = renderEmail("Hi", { heading: "Hello <b>", paragraphs: ["Line one\nline two"], details: [["Notes", "a & b"]] });
    expect(e.text).toContain("Notes: a & b");
    expect(e.html).toContain("Hello &lt;b&gt;");
    expect(e.html).toContain("a &amp; b");
    expect(e.html).toContain("Line one<br>line two");
  });

  it("confirms a booking with its details", () => {
    const e = bookingConfirmed(visit);
    expect(e.subject).toBe("Booked: Errands & shopping with Michelle K");
    expect(e.text).toContain("Where: 1 Main St");
    expect(e.text).toContain("Estimate: $100, paid after the visit");
  });

  it("only mentions a late charge when the client cancels inside the window", () => {
    expect(bookingCancelled(visit, "customer", hoursBefore(48)).text).toContain("no charge");
    expect(bookingCancelled(visit, "customer", hoursBefore(3)).text).toContain("late-cancellation charge may apply");
    expect(bookingCancelled(visit, "concierge", hoursBefore(3)).text).not.toContain("late-cancellation");
    expect(ownerCancelled(visit, "customer", hoursBefore(3)).text).toContain("late-cancellation");
  });
});

describe("reminders", () => {
  const booked = (h: number) => ({ kind: "VISIT" as const, start, createdAt: hoursBefore(h) });

  it("sends inside the window for bookings made before it", () => {
    expect(reminderDue(booked(72), hoursBefore(30))).toBe(false);
    expect(reminderDue(booked(72), hoursBefore(23))).toBe(true);
    expect(reminderDue(booked(72), hoursBefore(-1))).toBe(false);
  });

  it("skips bookings made inside the window, since the confirmation just went out", () => {
    expect(reminderDue(booked(10), hoursBefore(5))).toBe(false);
  });

  it("gives stays more notice", () => {
    expect(reminderDue({ ...booked(100), kind: "STAY" }, hoursBefore(40))).toBe(true);
  });
});
