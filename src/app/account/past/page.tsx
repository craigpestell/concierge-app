import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { BookingCard, BookingList } from "@/components/BookingCard";

export const metadata: Metadata = { title: "Past bookings" };

export default async function PastBookingsPage() {
  const user = await requireUser(undefined, "/account/past");
  const now = new Date();
  const past = await db.booking.findMany({
    where: { customerId: user.id, OR: [{ status: { not: "CONFIRMED" } }, { start: { lte: now } }] },
    include: { concierge: true, service: true },
    orderBy: { start: "desc" },
    take: 50,
  });

  return past.length ? (
    <BookingList>
      {past.map((b) => <BookingCard key={b.id} b={b} who={b.concierge.displayName} whoLabel="With" />)}
    </BookingList>
  ) : (
    <p className="empty">Nothing here yet. Finished and cancelled bookings show up here, with any note left after the visit.</p>
  );
}
