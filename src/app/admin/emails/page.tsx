import type { Metadata } from "next";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { getOwnerProfile } from "@/lib/owner";
import * as t from "@/lib/email-templates";

export const metadata: Metadata = { title: "Emails" };

/** A made-up visit and stay so every template can be previewed without real bookings. */
function samples(owner: { displayName: string; businessPhone: string | null } | null) {
  const day = 86_400_000;
  const base = new Date(Date.now() + 3 * day);
  base.setUTCHours(17, 0, 0, 0); // 10 am in Vancouver for most of the year
  const common = {
    customer: { name: "Jordan Lee", email: "jordan@example.com", phone: "604-555-0199" },
    concierge: owner ?? { displayName: brand.ownerName, businessPhone: null },
    address: "123 Columbia St, New Westminster",
  };
  const visit: t.BookingEmailData = { ...common, kind: "VISIT", start: base, end: new Date(base.getTime() + 2 * 3600_000), nights: null, notes: "Pick up dry cleaning on the way, please.", priceCents: 10000, service: { name: "Errands & shopping" } };
  const stayStart = new Date(base.getTime() + 7 * day);
  stayStart.setUTCHours(7, 0, 0, 0); // local midnight
  const stay: t.BookingEmailData = { ...common, kind: "STAY", start: stayStart, end: new Date(stayStart.getTime() + 5 * day), nights: 4, notes: "Two cats, one shy.", priceCents: 72000, service: { name: "Pets & plants" } };
  return { visit, stay };
}

export default async function EmailsPage() {
  await requireUser(["ADMIN"], "/admin/emails");
  const { visit, stay } = samples(await getOwnerProfile());
  const note = "All went well. Watered the plants and left the mail on the counter.";
  const groups: { title: string; who: string; items: { label: string; email: t.EmailContent }[] }[] = [
    {
      title: "To clients",
      who: "Sent to the client's email.",
      items: [
        { label: "Booking confirmed (visit)", email: t.bookingConfirmed(visit) },
        { label: "Booking confirmed (stay)", email: t.bookingConfirmed(stay) },
        { label: `Reminder, ${brand.reminderHours.VISIT} hours before a visit`, email: t.bookingReminder(visit) },
        { label: `Reminder, ${brand.reminderHours.STAY} hours before a stay`, email: t.bookingReminder(stay) },
        { label: "They cancelled (confirmation)", email: t.bookingCancelled(visit, "customer") },
        { label: "We cancelled", email: t.bookingCancelled(visit, "concierge") },
        { label: "Visit done", email: t.bookingDone(visit, note) },
        { label: "Sign-in link", email: t.signInLink("https://example.com/auth/verify?token=sample", 30) },
      ],
    },
    {
      title: "To you",
      who: "Sent to the addresses on the Notifications tab.",
      items: [
        { label: "New booking", email: t.ownerNewBooking(visit) },
        { label: "New stay", email: t.ownerNewBooking(stay) },
        { label: "Booking cancelled", email: t.ownerCancelled(visit, "customer") },
        { label: "Marked done", email: t.ownerDone(visit, note) },
      ],
    },
  ];

  return (
    <div className="stack" style={{ gap: "1.5rem" }}>
      {groups.map((g, n) => (
        <section key={g.title} className="panel narrow stack" style={{ gap: "0.8rem" }}>
          <div className="stack" style={{ gap: "0.4rem" }}>
            {n === 0 && <p className="muted small">Every email the site sends, shown with a sample booking. Open one to see it as it arrives.</p>}
            <h2 style={{ fontSize: "var(--step-2)" }}>{g.title}</h2>
            <p className="muted small">{g.who}</p>
          </div>
          {g.items.map((i) => (
            <details key={i.label} className="email-preview">
              <summary>
                <strong>{i.label}</strong>
                <span className="muted small"> · {i.email.subject}</span>
              </summary>
              <iframe title={i.label} srcDoc={i.email.html} sandbox="" loading="lazy" />
            </details>
          ))}
        </section>
      ))}
    </div>
  );
}
