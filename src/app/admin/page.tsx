import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/booking-actions";
import { money } from "@/lib/format";
import { getOwnerProfile } from "@/lib/owner";
import { features } from "@/lib/features";
import { BookingCard, BookingList } from "@/components/BookingCard";
import { Stats } from "@/components/DashHeader";

export const metadata: Metadata = { title: "Admin" };

const admin = () => requireUser(["ADMIN"], "/admin");

async function adminCancel(f: FormData) {
  "use server";
  await admin();
  await cancelBooking(String(f.get("id")), "admin");
  revalidatePath("/admin");
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await admin();
  const { error } = await searchParams;
  const now = new Date();
  const [owner, bookings] = await Promise.all([
    getOwnerProfile(),
    db.booking.findMany({ where: { end: { gt: now }, status: "CONFIRMED" }, include: { customer: true, service: true }, orderBy: { start: "asc" }, take: 200 }),
  ]);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 3600_000);
  const thisWeek = bookings.filter((b) => b.start < weekEnd);
  const stays = bookings.filter((b) => b.kind === "STAY");

  return (
    <>
      {error && <p className="notice error" role="alert">{error}</p>}
      {!owner && (
        <p className="notice">Your booking page isn&apos;t set up yet. <Link href="/concierge/setup">Set up your profile</Link> to open your calendar.</p>
      )}

      <Stats
        items={[
          { label: "Upcoming", value: bookings.length, hint: `${money(bookings.reduce((s, b) => s + b.priceCents, 0))} estimated` },
          { label: "Next 7 days", value: thisWeek.length, hint: `${money(thisWeek.reduce((s, b) => s + b.priceCents, 0))} estimated` },
          ...(features.stays() || stays.length
            ? [{ label: "Overnight stays", value: stays.length, hint: stays.length ? `${stays.reduce((s, b) => s + (b.nights ?? 0), 0)} nights booked` : "None booked" }]
            : []),
        ]}
      />

      <div className="panel" id="bookings">
        <h2 style={{ fontSize: "var(--step-2)" }}>Upcoming bookings</h2>
        {bookings.length ? (
          <BookingList>
            {bookings.map((b) => (
              <BookingCard key={b.id} b={b} who={<>{b.customer.name} <span className="muted">· <a href={`mailto:${b.customer.email}`}>{b.customer.email}</a></span></>}>
                <form action={adminCancel}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">Cancel</button></form>
              </BookingCard>
            ))}
          </BookingList>
        ) : (
          <p className="empty">No upcoming bookings.</p>
        )}
      </div>
    </>
  );
}
