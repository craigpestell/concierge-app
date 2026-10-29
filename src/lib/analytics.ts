// Google Analytics 4 helpers. Events are only sent when the gtag script is on the page,
// which is in production with a measurement ID set (see measurementId below).
import { brand } from "@/lib/brand";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

export type EventParams = Record<string, string | number | boolean | undefined>;

// The env var wins, so staging or a fork can point elsewhere; "off" turns tracking off.
export function measurementId(env: Record<string, string | undefined> = process.env): string | null {
  const id = (env.GA_MEASUREMENT_ID || brand.gaMeasurementId).trim();
  if (id === "off" || env.NODE_ENV !== "production") return null;
  return /^G-[A-Z0-9]+$/.test(id) ? id : null;
}

export function track(name: string, params: EventParams = {}) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

// Event names. Booking events carry booking_type ("visit" for hourly, "stay" for
// multi-day house and pet sitting) so both flows report into the same funnel.
export const events = {
  ctaClick: "cta_click", // cta, location
  contactClick: "contact_click", // method: phone | email, location
  bookingStart: "booking_start", // booking_type, service
  bookingComplete: "booking_complete", // booking_type, service, hours | nights, value, currency
  bookingError: "booking_error", // booking_type, reason
  signInRequest: "sign_in_request", // location
} as const;

type Clickable = { href?: string | null; dataset: Record<string, string | undefined> };

// Works out which event a click on a link or button should send, if any.
// Elements opt in with data-track="event_name" and data-track-<param>="value".
// Phone and email links are tracked automatically.
export function eventForClick(el: Clickable): { name: string; params: EventParams } | null {
  const params: EventParams = {};
  for (const [key, value] of Object.entries(el.dataset)) {
    if (key.startsWith("track") && key !== "track" && value !== undefined) {
      const param = key.slice(5).replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`).replace(/^_/, "");
      params[param] = value;
    }
  }
  if (el.dataset.track) return { name: el.dataset.track, params };
  const href = el.href ?? "";
  if (href.startsWith("tel:")) return { name: events.contactClick, params: { method: "phone", ...params } };
  if (href.startsWith("mailto:")) return { name: events.contactClick, params: { method: "email", ...params } };
  return null;
}
