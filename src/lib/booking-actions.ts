import { db } from "./db";
import { sendEmail } from "./email";
import { notifyOwners } from "./notify";
import { bookingCancelled, ownerCancelled } from "./email-templates";

/** Cancels a booking and tells the client and the owners. `by` says who cancelled. */
export async function cancelBooking(bookingId: string, by: "customer" | "concierge" | "admin") {
  const b = await db.booking.update({
    where: { id: bookingId },
    data: { status: "CANCELLED", cancelledAt: new Date() },
    include: { customer: true, concierge: { include: { user: true } }, service: true },
  });
  // The client always hears: a confirmation if they cancelled, an apology otherwise.
  await sendEmail({ to: b.customer.email, ...bookingCancelled(b, by, b.cancelledAt!) });
  await notifyOwners("cancelled", ownerCancelled(b, by, b.cancelledAt!), {
    // She knows when she cancelled one herself.
    fallback: b.concierge.user.email,
    exclude: by === "concierge" ? b.concierge.user.email : undefined,
  });
  return b;
}
