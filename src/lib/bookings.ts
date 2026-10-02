import { Prisma } from "@prisma/client";
import { db } from "./db";
import { brand } from "./brand";
import { sendEmail } from "./email";
import { isOpen } from "./slots";
import { localDate } from "./time";
import { busyIntervals, bookingWindow } from "./availability";
import { normalizeEmail, appUrl } from "./auth";
import { money, whenLabel } from "./format";

export type BookingRequest = {
  conciergeSlug: string;
  serviceSlug: string;
  start: string; // ISO instant
  hours: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes: string;
};

export class BookingError extends Error {}

export function validateBookingRequest(body: unknown): BookingRequest {
  const b = (body ?? {}) as Record<string, unknown>;
  const str = (k: string, max = 500) => (typeof b[k] === "string" ? (b[k] as string).trim().slice(0, max) : "");
  const req: BookingRequest = {
    conciergeSlug: str("conciergeSlug", 60),
    serviceSlug: str("serviceSlug", 60),
    start: str("start", 40),
    hours: Number(b.hours),
    name: str("name", 120),
    email: str("email", 200),
    phone: str("phone", 40),
    address: str("address", 300),
    notes: str("notes", 2000),
  };
  if (!req.conciergeSlug || !req.serviceSlug) throw new BookingError("Choose a concierge and a service.");
  if (!(brand.lengths as readonly number[]).includes(req.hours)) throw new BookingError("Choose a booking length.");
  if (Number.isNaN(Date.parse(req.start))) throw new BookingError("Choose a start time.");
  if (!req.name) throw new BookingError("Add your name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email)) throw new BookingError("Add a valid email address.");
  if (!req.address) throw new BookingError("Add where the concierge should meet you.");
  return req;
}

/** Creates a booking after re-checking that the time is still open. */
export async function createBooking(req: BookingRequest, now = new Date()) {
  const start = new Date(req.start);
  const end = new Date(start.getTime() + req.hours * 3600_000);
  const date = localDate(start, brand.timeZone);
  const win = bookingWindow(now);
  if (date < win.first || date > win.last) throw new BookingError("That date can't be booked.");

  const booking = await db.$transaction(
    async (tx) => {
      const concierge = await tx.conciergeProfile.findFirst({
        where: { slug: req.conciergeSlug, approved: true, visible: true },
        include: { availability: true, services: { include: { service: true } }, user: true },
      });
      if (!concierge) throw new BookingError("That concierge isn't taking bookings.");
      const service = concierge.services.find((s) => s.service.slug === req.serviceSlug && s.service.active)?.service;
      if (!service) throw new BookingError("That concierge doesn't offer this service.");

      const busy = await busyIntervals(concierge.id, date, date, tx);
      const open = isOpen(
        { date, hours: req.hours, weekly: concierge.availability, busy, now, timeZone: brand.timeZone, minLeadHours: brand.minLeadHours },
        start,
      );
      if (!open) throw new BookingError("Sorry, that time was just taken. Please pick another.");

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
          start,
          end,
          hours: req.hours,
          address: req.address,
          notes: req.notes,
          priceCents: concierge.hourlyRateCents * req.hours,
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
  const when = whenLabel(b.start, b.end);
  await sendEmail({
    to: b.customer.email,
    subject: `Booked: ${b.service.name} with ${b.concierge.displayName}`,
    text: `Hi ${b.customer.name},\n\nYou're booked with ${b.concierge.displayName}.\n\n${b.service.name}\n${when}\n${b.address}\nEstimate: ${money(b.priceCents)} (paid after the visit)\n\nTo see or cancel your booking, sign in with this email at ${appUrl()}/account\n\n${brand.name}`,
  });
  await sendEmail({
    to: b.concierge.user.email,
    subject: `New booking: ${b.service.name}, ${when}`,
    text: `New booking from ${b.customer.name}.\n\n${b.service.name}\n${when}\n${b.address}\nPhone: ${b.customer.phone ?? "not given"}\nEmail: ${b.customer.email}\nNotes: ${b.notes || "none"}\n\nSee your bookings at ${appUrl()}/concierge`,
  });
}
