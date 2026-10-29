import { db } from "./db";
import { brand } from "./brand";
import { sendEmail } from "./email";
import { bookingWhen } from "./format";
import { formatPhone } from "./phone";

/** Cancels a booking and tells the other side. `by` says who cancelled. */
export async function cancelBooking(bookingId: string, by: "customer" | "concierge" | "admin") {
  const b = await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { customer: true, concierge: { include: { user: true } }, service: true },
  });
  const when = bookingWhen(b);
  if (by !== "concierge") {
    await sendEmail({
      to: b.concierge.user.email,
      subject: `Cancelled: ${b.service.name}, ${when}`,
      text: `${b.customer.name}'s booking for ${when} has been cancelled. Those ${b.kind === "STAY" ? "days are" : "hours are"} open again on your calendar.`,
    });
  }
  if (by !== "customer") {
    await sendEmail({
      to: b.customer.email,
      subject: `Your booking for ${when} was cancelled`,
      text: `Sorry, your ${b.service.name} booking with ${b.concierge.displayName} for ${when} was cancelled. Please book another time, or call ${b.concierge.businessPhone ? formatPhone(b.concierge.businessPhone) : brand.phone} and we'll help.`,
    });
  }
  return b;
}
