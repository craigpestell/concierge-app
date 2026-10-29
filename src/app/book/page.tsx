import type { Metadata } from "next";
import { brand } from "@/lib/brand";
import { money } from "@/lib/format";
import { bookingWindow, stayOffer } from "@/lib/availability";
import { currentUser } from "@/lib/auth";
import { getOwner, firstName, publicPhone } from "@/lib/owner";
import { Avatar } from "@/components/Avatar";
import { BookingCalendar } from "@/components/BookingCalendar";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const c = await getOwner();
  return { title: c ? `Book ${firstName(c.displayName)}` : "Book" };
}

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const [{ service }, c, phone] = await Promise.all([searchParams, getOwner(), publicPhone()]);
  if (!c) {
    return (
      <section className="section">
        <div className="wrap stack" style={{ maxWidth: 640 }}>
          <p className="eyebrow">Book</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>Online booking opens soon</h1>
          <p className="muted">In the meantime, call or text {phone} or email {brand.email}.</p>
        </div>
      </section>
    );
  }
  const user = await currentUser();
  const stay = stayOffer(c.nightlyRateCents);
  const services = c.services
    .filter((s) => s.service.active)
    .sort((a, b) => a.service.sort - b.service.sort)
    .map((s) => ({ slug: s.service.slug, name: s.service.name }));

  return (
    <section className="section">
      <div className="wrap profile">
        <aside className="profile-side">
          <Avatar name={c.displayName} photoUrl={c.photoUrl} large />
          <h1 style={{ fontSize: "var(--step-3)" }}>{c.displayName}</h1>
          {c.headline && <p className="lede" style={{ fontSize: "var(--step-0)" }}>{c.headline}</p>}
          <p className="rate">{money(c.hourlyRateCents)}/hour · paid after the visit</p>
          {stay && <p className="muted small">Overnight house and pet sitting: {money(stay.rateCents)} a night</p>}
          <p className="muted small">Serves {c.areas.join(", ")}</p>
          <div className="tags">{services.map((s) => <span className="tag" key={s.slug}>{s.name}</span>)}</div>
          {c.bio && <p className="bio">{c.bio}</p>}
        </aside>
        <div className="stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <p className="eyebrow">Book {firstName(c.displayName)}</p>
            <h2>Pick a time that suits you</h2>
          </div>
          {services.length ? (
            <BookingCalendar
              slug={c.slug}
              conciergeName={c.displayName}
              services={services}
              initialService={services.some((s) => s.slug === service) ? service! : services[0]!.slug}
              rateCents={c.hourlyRateCents}
              lengths={[...brand.lengths]}
              window={bookingWindow()}
              timeZone={brand.timeZone}
              prefill={user ? { name: user.name, email: user.email, phone: user.phone ?? "" } : null}
              stay={stay}
            />
          ) : (
            <p className="empty">Services are being set up. Call or text {phone} to book in the meantime.</p>
          )}
        </div>
      </div>
    </section>
  );
}
