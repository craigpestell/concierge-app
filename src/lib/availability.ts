import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { brand } from "./brand";
import { openStarts, datesBetween, type Interval } from "./slots";
import { addDays, localDate, zonedToInstant } from "./time";

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
