// Everything brand-specific lives here, so the business can be renamed in one place.
export const brand = {
  name: "Royal City Concierge",
  shortName: "Royal City",
  monogram: "RC",
  tagline: "Your time, thoughtfully handled.",
  area: "New Westminster & Burnaby",
  // Shown when her profile isn't set up yet; otherwise the profile's name is used.
  ownerName: "Michelle",
  description:
    "A bespoke personal concierge in New Westminster and Burnaby. One dedicated person for errands, appointments, home and pet care, and the details that fill your week.",
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
  // How far ahead clients get a reminder email. Stays get more notice to sort out keys and care notes.
  reminderHours: { VISIT: 24, STAY: 48 },
  // Google Analytics 4 web stream. Public, not a secret. GA_MEASUREMENT_ID overrides it.
  gaMeasurementId: "G-1S4M1FYZW3",
  // Longest overnight stay that can be booked online.
  maxStayNights: 30,
  // Stays are priced per day: the client's estimate of waking hours of care at the hourly rate,
  // plus her flat overnight rate for the roughly 8 hours she sleeps there.
  stayCareHours: { min: 1, max: 16, default: 3 },
} as const;
