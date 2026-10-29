import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { notifyOwners } from "@/lib/notify";
import { cancelBooking } from "@/lib/booking-actions";
import { money, bookingWhen } from "@/lib/format";
import { myProfile } from "@/lib/my-profile";
import { BookingCard, BookingList } from "@/components/BookingCard";
import { Stats } from "@/components/DashHeader";

export const metadata: Metadata = { title: "My schedule" };

async function markDone(f: FormData) {
  "use server";
  const { user, profile } = await myProfile();
  const id = String(f.get("id"));
  const note = String(f.get("note") ?? "").trim().slice(0, 2000);
  const b = await db.booking.findFirst({ where: { id, conciergeId: profile.id, status: "CONFIRMED" }, include: { customer: true, service: true } });
  if (!b) return;
  await db.booking.update({ where: { id }, data: { status: "DONE", completedAt: new Date(), visitNote: note || null } });
  await sendEmail({
    to: b.customer.email,
    subject: `${profile.displayName} finished your ${b.service.name.toLowerCase()} ${b.kind === "STAY" ? "stay" : "visit"}`,
    text: `Hi ${b.customer.name},\n\n${profile.displayName} has finished your ${b.kind === "STAY" ? "stay" : "visit"}, ${bookingWhen(b)}.${note ? `\n\nTheir note:\n${note}` : ""}\n\nThanks for booking with ${brand.name}.`,
  });
  await notifyOwners(
    "done",
    {
      subject: `Done: ${b.service.name}, ${bookingWhen(b)}`,
      text: `${profile.displayName} marked ${b.customer.name}'s ${b.kind === "STAY" ? "stay" : "visit"} for ${bookingWhen(b)} as done.${note ? `\n\nNote to the client:\n${note}` : ""}`,
    },
    { exclude: user.email },
  );
  revalidatePath("/concierge", "layout");
}

async function cancelAsConcierge(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const b = await db.booking.findFirst({ where: { id: String(f.get("id")), conciergeId: profile.id, status: "CONFIRMED" } });
  if (b) await cancelBooking(b.id, "concierge");
  revalidatePath("/concierge", "layout");
}

export default async function ScheduleBookings() {
  const { profile } = await myProfile();
  const now = new Date();
  const bookings = await db.booking.findMany({
    where: { conciergeId: profile.id, OR: [{ end: { gt: addHours(now, -72) } }, { status: "CONFIRMED" }] },
    include: { customer: true, service: true },
    orderBy: { start: "asc" },
  });
  const toCloseOut = bookings.filter((b) => b.status === "CONFIRMED" && b.start <= now);
  const upcoming = bookings.filter((b) => b.status === "CONFIRMED" && b.start > now);
  const recent = bookings.filter((b) => b.status !== "CONFIRMED").reverse();
  const weekEnd = addHours(now, 7 * 24);
  const thisWeek = upcoming.filter((b) => b.start < weekEnd);
  const next = upcoming[0];

  const client = (b: (typeof bookings)[number]) => (
    <>
      {b.customer.name}
      <span className="muted"> · {b.customer.phone ? <><a href={`tel:${b.customer.phone}`}>{b.customer.phone}</a> · </> : null}<a href={`mailto:${b.customer.email}`}>{b.customer.email}</a></span>
    </>
  );

  return (
    <>
      <Stats
        items={[
          { label: "Next booking", value: next ? bookingWhen(next) : "None yet", hint: next ? `${next.kind === "STAY" ? "Overnight stay · " : ""}${next.service.name}` : <Link href="/book">See your booking page</Link> },
          { label: "Next 7 days", value: `${thisWeek.length} booking${thisWeek.length === 1 ? "" : "s"}`, hint: thisWeek.length ? `${money(thisWeek.reduce((s, b) => s + b.priceCents, 0))} estimated` : undefined },
          { label: "To close out", value: toCloseOut.length, hint: toCloseOut.length ? "Add a note and mark them done" : "All caught up" },
        ]}
      />

      {toCloseOut.length > 0 && (
        <div className="panel" id="close-out">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>To close out</h2>
            <span className="muted small">Started or finished, not yet marked done</span>
          </div>
          <BookingList>
            {toCloseOut.map((b) => (
              <BookingCard key={b.id} b={b} who={client(b)}>
                <form action={markDone} className="stack" style={{ gap: "0.5rem" }}>
                  <input type="hidden" name="id" value={b.id} />
                  <div className="field">
                    <label htmlFor={`note-${b.id}`}>{b.kind === "STAY" ? "Stay" : "Visit"} note for the customer</label>
                    <textarea id={`note-${b.id}`} name="note" style={{ minHeight: "4.5rem" }} placeholder="Optional. It's emailed to them." />
                  </div>
                  <div><button className="btn btn-sm" type="submit">Mark done</button></div>
                </form>
              </BookingCard>
            ))}
          </BookingList>
        </div>
      )}

      <div className="panel" id="upcoming">
        <h2 style={{ fontSize: "var(--step-2)" }}>Upcoming</h2>
        {upcoming.length ? (
          <BookingList>
            {upcoming.map((b) => (
              <BookingCard key={b.id} b={b} who={client(b)}>
                <form action={cancelAsConcierge}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">Cancel</button></form>
              </BookingCard>
            ))}
          </BookingList>
        ) : (
          <p className="empty">No upcoming bookings. Clients book from <Link href="/book">your booking page</Link>.</p>
        )}
      </div>

      {recent.length > 0 && (
        <div className="panel" id="recent">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>Recently done or cancelled</h2>
            <span className="muted small">Last 3 days</span>
          </div>
          <BookingList>
            {recent.map((b) => <BookingCard key={b.id} b={b} who={client(b)} />)}
          </BookingList>
        </div>
      )}
    </>
  );
}

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600_000);
}
