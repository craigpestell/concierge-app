import { db } from "./db";
import { brand } from "./brand";
import { sendEmail } from "./email";
import { bookingReminder } from "./email-templates";

const hours = (n: number) => n * 3600_000;

/**
 * Whether a booking is due its reminder at `now`: it starts within the reminder window, and
 * it was booked before that window opened (otherwise the confirmation just went out).
 */
export function reminderDue(b: { kind: "VISIT" | "STAY"; start: Date; createdAt: Date }, now: Date) {
  const opens = b.start.getTime() - hours(brand.reminderHours[b.kind]);
  return b.start > now && now.getTime() >= opens && b.createdAt.getTime() < opens;
}

/** Emails every client whose booking is coming up and hasn't been reminded. Safe to run often. */
export async function sendDueReminders(now = new Date()) {
  const longest = Math.max(...Object.values(brand.reminderHours));
  const candidates = await db.booking.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, start: { gt: now, lte: new Date(now.getTime() + hours(longest)) } },
    include: { customer: true, concierge: true, service: true },
  });
  let sent = 0;
  for (const b of candidates) {
    if (!reminderDue(b, now)) continue;
    // Claim it first, so two runs can't both send.
    const claimed = await db.booking.updateMany({ where: { id: b.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (!claimed.count) continue;
    await sendEmail({ to: b.customer.email, ...bookingReminder(b) });
    sent++;
  }
  return sent;
}
