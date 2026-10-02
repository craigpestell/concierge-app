import Link from "next/link";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { ConciergeCard, conciergeCardInclude } from "@/components/ConciergeCard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const featured = await db.conciergeProfile.findMany({
    where: { approved: true, visible: true },
    include: conciergeCardInclude,
    orderBy: { createdAt: "asc" },
    take: 3,
  });
  const services = await db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } });

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap">
          <div>
            <p className="eyebrow">Personal concierge · {brand.area}</p>
            <h1 id="hero-title">
              Life gets busy.<br />
              <em>We can help.</em>
            </h1>
            <p className="lede">
              Choose a local concierge, see their calendar and book a time. Errands, rides, pet visits, home checks and the
              small jobs that pile up.
            </p>
            <div className="actions" style={{ marginTop: "2rem" }}>
              <Link className="btn" href="/concierges">Find a concierge</Link>
              <Link className="btn btn-ghost" href="/concierges?service=visit-for-a-parent">Help for an aging parent</Link>
            </div>
          </div>
          <div className="keytag-stage" aria-hidden="true">
            <div className="keytag">
              <div className="k-label">Personal Concierge</div>
              <div className="k-name">{brand.name.split(" ").slice(0, 2).join(" ")}<br />{brand.name.split(" ").slice(2).join(" ")}</div>
              <div className="k-rule" />
              <div className="k-area">New Westminster · Burnaby</div>
            </div>
          </div>
        </div>
      </section>

      <div className="ribbon" aria-label="Services">
        <div className="wrap">
          <ul>{services.map((s) => <li key={s.id}>{s.name}</li>)}</ul>
        </div>
      </div>

      <section className="section" aria-labelledby="featured-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Our concierges</p>
            <h2 id="featured-title">Pick the person, then the time</h2>
            <p>Every concierge has their own profile and calendar, so you know exactly who is coming.</p>
          </div>
          {featured.length ? (
            <div className="cards">{featured.map((c) => <ConciergeCard key={c.id} c={c} />)}</div>
          ) : (
            <p className="empty">Concierge profiles will appear here once they're approved.</p>
          )}
          <div style={{ marginTop: "1.6rem" }}><Link className="btn btn-ghost" href="/concierges">See all concierges</Link></div>
        </div>
      </section>

      <section className="section section-alt" id="how" aria-labelledby="how-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">Three steps, then it's off your plate</h2>
          </div>
          <div className="steps">
            <div className="step"><span className="step-n">1</span><h3>Choose a concierge</h3><p>Browse profiles by service and area, and read who they are.</p></div>
            <div className="step"><span className="step-n">2</span><h3>Book from their calendar</h3><p>Pick a service, how long you need and an open time. You get a confirmation by email right away.</p></div>
            <div className="step"><span className="step-n">3</span><h3>Consider it done</h3><p>Your concierge takes care of it and sends a short note when they're finished. You pay after the visit.</p></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="limits-title">
        <div className="wrap stack" style={{ maxWidth: 780 }}>
          <p className="eyebrow">Good to know</p>
          <h2 id="limits-title">What our concierges don't do</h2>
          <p className="muted">To keep things clear and safe, this is a non-medical service. For these, we'll point you to the right professional.</p>
          <ul className="not-list">
            <li>Personal or medical care</li><li>Giving medications</li><li>Childcare</li><li>Licensed trades or major repairs</li>
          </ul>
          <p className="muted small">Questions? Call or text {brand.phone} or email {brand.email}.</p>
        </div>
      </section>
    </>
  );
}
