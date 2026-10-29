import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { brand } from "./brand";
import { openStarts, datesBetween, stayBlockedDates, type Interval } from "./slots";
import { addDays, localDate, zonedToInstant } from "./time";
import { features } from "./features";

/** First and last bookable dates as of now. */
export function bookingWindow(now = new Date()) {
  const today = localDate(now, brand.timeZone);
  return { first: today, last: addDays(today, brand.bookingWindowDays) };
}

/** Busy intervals (bookings and time off) for a concierge between two dates. */
export async function busyIntervals(conciergeId: string, from: string, to: string, client: Prisma.TransactionClient = db): Promise<Interval[]> {
  const rangeStart = zonedToInstant(from, 0, brand.timeZone);
  const rangeEnd = zonedToInstant(addDays(to, 1), 0, brand.timeZone);
  const [bookings, timeOff] = await Promise.all([
    client.booking.findMany({
      where: { conciergeId, status: { not: "CANCELLED" }, start: { lt: rangeEnd }, end: { gt: rangeStart } },
      select: { start: true, end: true },
    }),
    client.timeOff.findMany({
      where: { conciergeId, start: { lt: rangeEnd }, end: { gt: rangeStart } },
      select: { start: true, end: true },
    }),
  ]);
  return [...bookings, ...timeOff];
}

/** Open start times per date for a concierge, clipped to the booking window. */
export async function openTimesByDate(conciergeId: string, from: string, to: string, hours: number, now = new Date()) {
  const win = bookingWindow(now);
  const start = from < win.first ? win.first : from;
  const end = to > win.last ? win.last : to;
  const days: Record<string, string[]> = {};
  if (start > end) return days;

  const [weekly, busy] = await Promise.all([
    db.availability.findMany({ where: { conciergeId }, select: { weekday: true, startMin: true, endMin: true } }),
    busyIntervals(conciergeId, start, end),
  ]);
  for (const date of datesBetween(start, end)) {
    const starts = openStarts({ date, hours, weekly, busy, now, timeZone: brand.timeZone, minLeadHours: brand.minLeadHours });
    if (starts.length) days[date] = starts.map((s) => s.toISOString());
  }
  return days;
}

/**
 * Stay rules: a stay can start tomorrow at the earliest and must end inside the booking window.
 * Weekly hours don't apply, since she lives in for the whole stay.
 */
export function stayWindow(now = new Date()) {
  const win = bookingWindow(now);
  return { first: addDays(win.first, 1), last: win.last, maxNights: brand.maxStayNights };
}

/** Days in the stay window that a stay can't include, because of a booking or time off. */
export async function blockedStayDates(conciergeId: string, now = new Date()) {
  const win = stayWindow(now);
  const busy = await busyIntervals(conciergeId, win.first, win.last);
  return stayBlockedDates(win.first, win.last, busy, brand.timeZone);
}

/** What the booking calendar needs to offer stays, or null when stays are off or she has no nightly rate. */
export function stayOffer(nightlyRateCents: number | null, now = new Date()) {
  if (!features.stays() || nightlyRateCents == null) return null;
  return { rateCents: nightlyRateCents, ...stayWindow(now) };
}
