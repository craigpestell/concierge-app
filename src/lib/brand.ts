// Everything brand-specific lives here, so the business can be renamed in one place.
export const brand = {
  name: "Royal City Concierge",
  shortName: "Royal City",
  monogram: "RC",
  tagline: "Life gets busy. We can help.",
  area: "New Westminster & Burnaby",
  description:
    "Book a trusted local concierge for errands, rides, pet visits, home checks and everyday help in New Westminster and Burnaby.",
  // Placeholder contact details. Replace before launch.
  phone: "604-555-0142",
  email: "hello@royalcityconcierge.com",
  hours: "Mon–Sat, 8 am – 6 pm",
  // Business time zone. All calendars are shown in this zone.
  timeZone: "America/Vancouver",
  // Booking rules.
  minLeadHours: 12,
  bookingWindowDays: 56,
  lengths: [1, 2, 3, 4],
  cancelFreeHours: 24,
} as const;
