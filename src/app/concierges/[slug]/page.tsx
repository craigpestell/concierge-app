import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { money } from "@/lib/format";
import { bookingWindow } from "@/lib/availability";
import { currentUser } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { BookingCalendar } from "@/components/BookingCalendar";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return db.conciergeProfile.findFirst({
    where: { slug, approved: true, visible: true },
    include: { services: { include: { service: true } } },
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await load((await params).slug);
  return { title: c ? c.displayName : "Concierge" };
}

export default async function ConciergePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const [{ slug }, { service }] = await Promise.all([params, searchParams]);
  const c = await load(slug);
  if (!c) notFound();
  const user = await currentUser();
  const services = c.services
    .filter((s) => s.service.active)
    .sort((a, b) => a.service.sort - b.service.sort)
    .map((s) => ({ slug: s.service.slug, name: s.service.name }));

  return (
    <section className="section">
      <div className="wrap profile">
        <aside className="profile-side">
          <Link className="small muted" href="/concierges">← All concierges</Link>
          <Avatar name={c.displayName} photoUrl={c.photoUrl} large />
          <h1 style={{ fontSize: "var(--step-3)" }}>{c.displayName}</h1>
          {c.headline && <p className="lede" style={{ fontSize: "var(--step-0)" }}>{c.headline}</p>}
          <p className="rate">{money(c.hourlyRateCents)}/hour · paid after the visit</p>
          <p className="muted small">Serves {c.areas.join(", ")}</p>
          <div className="tags">{services.map((s) => <span className="tag" key={s.slug}>{s.name}</span>)}</div>
          {c.bio && <p className="bio">{c.bio}</p>}
        </aside>
        <div className="stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <p className="eyebrow">Book {c.displayName.split(" ")[0]}</p>
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
            />
          ) : (
            <p className="empty">{c.displayName} hasn't listed any services yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}
