import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { cancelBooking } from "@/lib/booking-actions";
import { BookingCard, BookingList } from "@/components/BookingCard";

export const metadata: Metadata = { title: "My bookings" };

async function cancel(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id"));
  const b = await db.booking.findFirst({ where: { id, customerId: user.id, status: "CONFIRMED", start: { gt: new Date() } } });
  if (b) await cancelBooking(b.id, "customer");
  revalidatePath("/account", "layout");
}

export default async function AccountPage() {
  const user = await requireUser(undefined, "/account");
  const now = new Date();
  const upcoming = await db.booking.findMany({
    where: { customerId: user.id, status: "CONFIRMED", start: { gt: now } },
    include: { concierge: true, service: true },
    orderBy: { start: "asc" },
    take: 50,
  });

  return upcoming.length ? (
    <BookingList>
      {upcoming.map((b) => {
        const late = b.start.getTime() - now.getTime() < brand.cancelFreeHours * 3600_000;
        return (
          <BookingCard key={b.id} b={b} who={b.concierge.displayName} whoLabel="With">
            <form action={cancel}>
              <input type="hidden" name="id" value={b.id} />
              <button className="link-btn" type="submit">Cancel booking</button>
            </form>
            {late && <p className="hint">Less than {brand.cancelFreeHours} hours away. A late-cancellation charge may apply.</p>}
          </BookingCard>
        );
      })}
    </BookingList>
  ) : (
    <p className="empty">No upcoming bookings. <Link href="/#book">Book a time</Link>.</p>
  );
}
