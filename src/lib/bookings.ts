import { Prisma } from "@prisma/client";
import { db } from "./db";
import { brand } from "./brand";
import { sendEmail } from "./email";
import { notifyOwners } from "./notify";
import { bookingConfirmed, ownerNewBooking } from "./email-templates";
import { isOpen, nightsBetween, stayInterval, stayIsOpen } from "./slots";
import { isValidDate, localDate } from "./time";
import { busyIntervals, bookingWindow, stayWindow } from "./availability";
import { normalizeEmail } from "./auth";

type Contact = {
  conciergeSlug: string;
  serviceSlug: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

/** A visit is booked by the hour. A stay is booked by the night, from an arrival day to a departure day. */
export type BookingRequest = Contact &
  (
    | { kind: "visit"; start: string /* ISO instant */; hours: number }
    | { kind: "stay"; firstDay: string /* YYYY-MM-DD */; lastDay: string }
  );

export class BookingError extends Error {}

export function validateBookingRequest(body: unknown): BookingRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string, max = 500) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const contact: Contact = {
    conciergeSlug: str("conciergeSlug", 60),
    serviceSlug: str("serviceSlug", 60),
    name: str("name", 120),
    email: str("email", 200),
    phone: str("phone", 40),
    address: str("address", 300),
    notes: str("notes", 2000),
  };
  if (!contact.conciergeSlug || !contact.serviceSlug) throw new BookingError("Choose a concierge and a service.");

  let req: BookingRequest;
  if (b.kind === "stay") {
    req = { ...contact, kind: "stay", firstDay: str("firstDay", 10), lastDay: str("lastDay", 10) };
    if (!isValidDate(req.firstDay) || !isValidDate(req.lastDay)) throw new BookingError("Choose the days of your stay.");
    const nights = nightsBetween(req.firstDay, req.lastDay);
    if (nights < 1) throw new BookingError("A stay needs at least one night.");
    if (nights > brand.maxStayNights) throw new BookingError(`Stays can be booked online for up to ${brand.maxStayNights} nights. Call for anything longer.`);
  } else {
    req = { ...contact, kind: "visit", start: str("start", 40), hours: Number(b.hours) };
    if (!(brand.lengths as readonly number[]).includes(req.hours)) throw new BookingError("Choose a booking length.");
    if (Number.isNaN(Date.parse(req.start))) throw new BookingError("Choose a start time.");
  }
  if (!contact.name) throw new BookingError("Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) throw new BookingError("Add a valid email address.");
  if (!contact.address) throw new BookingError(req.kind === "stay" ? "Add the address of the home." : "Add where the concierge should meet you.");
  return req;
}

/** Creates a booking after re-checking that the time is still open. */
export async function createBooking(req: BookingRequest, now = new Date()) {
  let start: Date, end: Date, first: string, last: string;
  if (req.kind === "stay") {
    const win = stayWindow(now);
    if (req.firstDay < win.first || req.lastDay > win.last) throw new BookingError("Those dates can't be booked.");
    ({ start, end } = stayInterval(req.firstDay, req.lastDay, brand.timeZone));
    [first, last] = [req.firstDay, req.lastDay];
  } else {
    start = new Date(req.start);
    end = new Date(start.getTime() + req.hours * 3600_000);
    first = last = localDate(start, brand.timeZone);
    const win = bookingWindow(now);
    if (first < win.first || first > win.last) throw new BookingError("That date can't be booked.");
  }

  const booking = await db.$transaction(
    async (tx) => {
      const concierge = await tx.conciergeProfile.findFirst({
        where: { slug: req.conciergeSlug, approved: true, visible: true },
        include: { availability: true, services: { include: { service: true } }, user: true },
      });
      if (!concierge) throw new BookingError("That concierge isn't taking bookings.");
      const service = concierge.services.find((s) => s.service.slug === req.serviceSlug && s.service.active)?.service;
      if (!service) throw new BookingError("That concierge doesn't offer this service.");

      const busy = await busyIntervals(concierge.id, first, last, tx);
      let priceCents: number;
      if (req.kind === "stay") {
        if (concierge.nightlyRateCents == null) throw new BookingError("Overnight stays aren't available to book online.");
        if (!stayIsOpen(req.firstDay, req.lastDay, busy, brand.timeZone)) {
          throw new BookingError("Sorry, some of those days were just booked. Please pick other dates.");
        }
        priceCents = concierge.nightlyRateCents * nightsBetween(req.firstDay, req.lastDay);
      } else {
        const open = isOpen(
          { date: first, hours: req.hours, weekly: concierge.availability, busy, now, timeZone: brand.timeZone, minLeadHours: brand.minLeadHours },
          start,
        );
        if (!open) throw new BookingError("Sorry, that time was just taken. Please pick another.");
        priceCents = concierge.hourlyRateCents * req.hours;
      }

      const email = normalizeEmail(req.email);
      const customer = await tx.user.upsert({
        where: { email },
        update: { phone: req.phone || undefined },
        create: { email, name: req.name, phone: req.phone || null },
      });
      return tx.booking.create({
        data: {
          customerId: customer.id,
          conciergeId: concierge.id,
          serviceId: service.id,
          kind: req.kind === "stay" ? "STAY" : "VISIT",
          start,
          end,
          hours: req.kind === "stay" ? 0 : req.hours,
          nights: req.kind === "stay" ? nightsBetween(req.firstDay, req.lastDay) : null,
          address: req.address,
          notes: req.notes,
          priceCents,
        },
        include: { concierge: { include: { user: true } }, service: true, customer: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );

  await sendBookingEmails(booking.id);
  return booking;
}

export async function sendBookingEmails(bookingId: string) {
  const b = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    include: { concierge: { include: { user: true } }, service: true, customer: true },
  });
  await sendEmail({ to: b.customer.email, ...bookingConfirmed(b) });
  await notifyOwners(b.kind === "STAY" ? "stay" : "booking", ownerNewBooking(b), { fallback: b.concierge.user.email });
}
