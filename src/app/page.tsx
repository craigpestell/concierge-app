import Link from "next/link";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { getOwner, firstName } from "@/lib/owner";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [owner, services] = await Promise.all([
    getOwner(),
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
  ]);
  const name = owner ? firstName(owner.displayName) : null;

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap">
          <div>
            <p className="eyebrow">Personal concierge · {brand.area}</p>
            <h1 id="hero-title">
              Your time,<br />
              <em>thoughtfully handled.</em>
            </h1>
            <p className="lede">
              A bespoke personal concierge for people who want one dependable person to rely on. Errands, appointments,
              home and pet care, and the details that fill your week, done properly and with discretion.
            </p>
            <div className="actions" style={{ marginTop: "2rem" }}>
              <Link className="btn" href="/book">{name ? `Book ${name}` : "Book a time"}</Link>
              <Link className="btn btn-ghost" href="/#meet">{name ? `Meet ${name}` : "How it works"}</Link>
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

      <section className="section" id="meet" aria-labelledby="meet-title">
        <div className="wrap">
          {owner ? (
            <div className="meet">
              <Avatar name={owner.displayName} photoUrl={owner.photoUrl} large />
              <div className="stack">
                <p className="eyebrow">Your concierge</p>
                <h2 id="meet-title">Meet {owner.displayName}</h2>
                {owner.headline && <p className="lede" style={{ fontSize: "var(--step-0)" }}>{owner.headline}</p>}
                {owner.bio && <p className="bio">{owner.bio}</p>}
                <p className="rate">{money(owner.hourlyRateCents)}/hour · paid after the visit</p>
                <div><Link className="btn" href="/book">See open times</Link></div>
              </div>
            </div>
          ) : (
            <div className="section-head">
              <p className="eyebrow">Your concierge</p>
              <h2 id="meet-title">One person, every time</h2>
              <p>You won't be passed between helpers. The same dependable person learns your preferences and looks after you.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section section-alt" id="how" aria-labelledby="how-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">Three steps, then it's off your mind</h2>
          </div>
          <div className="steps">
            <div className="step"><span className="step-n">1</span><h3>Pick a time</h3><p>Choose what you need, how long and an open time on {name ? `${name}'s` : "the"} calendar.</p></div>
            <div className="step"><span className="step-n">2</span><h3>Share the details</h3><p>Add notes, preferences and access instructions. You get a confirmation by email right away.</p></div>
            <div className="step"><span className="step-n">3</span><h3>Consider it done</h3><p>{name ?? "Your concierge"} takes care of it personally and sends a short note when it's finished. You pay after the visit.</p></div>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="limits-title">
        <div className="wrap stack" style={{ maxWidth: 780 }}>
          <p className="eyebrow">Good to know</p>
          <h2 id="limits-title">What isn't included</h2>
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
