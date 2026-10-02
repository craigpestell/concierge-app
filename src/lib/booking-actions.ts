import { db } from "./db";
import { brand } from "./brand";
import { sendEmail } from "./email";
import { whenLabel } from "./format";

/** Cancels a booking and tells the other side. `by` says who cancelled. */
export async function cancelBooking(bookingId: string, by: "customer" | "concierge" | "admin") {
  const b = await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { customer: true, concierge: { include: { user: true } }, service: true },
  });
  const when = whenLabel(b.start, b.end);
  if (by !== "concierge") {
    await sendEmail({
      to: b.concierge.user.email,
      subject: `Cancelled: ${b.service.name}, ${when}`,
      text: `${b.customer.name}'s booking for ${when} has been cancelled. The time is open again on your calendar.`,
    });
  }
  if (by !== "customer") {
    await sendEmail({
      to: b.customer.email,
      subject: `Your booking on ${when} was cancelled`,
      text: `Sorry, your ${b.service.name} booking with ${b.concierge.displayName} on ${when} was cancelled. Please book another time, or call ${brand.phone} and we'll help.`,
    });
  }
  return b;
}
