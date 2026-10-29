import Link from "next/link";
import { brand } from "@/lib/brand";
import { db } from "@/lib/db";
import { money } from "@/lib/format";
import { currentUser } from "@/lib/auth";
import { bookingWindow, stayOffer } from "@/lib/availability";
import { getOwner, firstName, publicPhone } from "@/lib/owner";
import { telHref } from "@/lib/phone";
import { serviceGroups, familyVisit, notIncluded, faqs } from "@/lib/content";
import { Avatar } from "@/components/Avatar";
import { BookingCalendar } from "@/components/BookingCalendar";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [owner, services, user, phone] = await Promise.all([
    getOwner(),
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    currentUser(),
    publicPhone(),
  ]);
  const name = owner ? firstName(owner.displayName) : brand.ownerName;
  const rate = owner ? money(owner.hourlyRateCents) : null;
  const stay = owner ? stayOffer(owner.nightlyRateCents) : null;
  const bookable = owner
    ? owner.services
        .filter((s) => s.service.active)
        .sort((a, b) => a.service.sort - b.service.sort)
        .map((s) => ({ slug: s.service.slug, name: s.service.name }))
    : [];

  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="wrap">
          <div>
            <p className="eyebrow">Personal concierge · {brand.area}</p>
            <h1 id="hero-title">
              Life gets busy.<br />
              <em>{name} can help.</em>
            </h1>
            <p className="lede">
              One trusted, local person for the errands, rides, pet visits, home checks and small jobs that pile up. Tell{" "}
              {name} what needs doing and she&apos;ll figure out the rest.
            </p>
            <div className="actions" style={{ marginTop: "2rem" }}>
              <Link className="btn" href="/#book" data-track="cta_click" data-track-cta="book_a_time" data-track-location="hero">Book a time</Link>
              <Link className="btn btn-ghost" href="/#families" data-track="cta_click" data-track-cta="aging_parent" data-track-location="hero">Help for an aging parent</Link>
            </div>
            {rate && <p className="muted small" style={{ marginTop: "1.2rem" }}>{rate}/hour · one-hour minimum · serving {brand.area}</p>}
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

      <section className="section" id="book" aria-labelledby="book-title">
        <div className="wrap stack">
          <div className="section-head" style={{ marginBottom: 0 }}>
            <p className="eyebrow">Book a time</p>
            <h2 id="book-title">Pick a time that suits you.</h2>
            <p>
              Choose what you need, how long and a start time on {name}&apos;s calendar.
              {stay && <> Going away? Book an overnight stay and {name} will look after your pets and home while you&apos;re gone.</>} You&apos;ll get a confirmation by email right away.
            </p>
          </div>
          {owner && bookable.length ? (
            <BookingCalendar
              slug={owner.slug}
              conciergeName={owner.displayName}
              services={bookable}
              initialService={bookable[0]!.slug}
              rateCents={owner.hourlyRateCents}
              lengths={[...brand.lengths]}
              window={bookingWindow()}
              timeZone={brand.timeZone}
              prefill={user ? { name: user.name, email: user.email, phone: user.phone ?? "" } : null}
              stay={stay}
            />
          ) : (
            <p className="empty">Online booking opens soon. In the meantime, call or text {phone} or email {brand.email}.</p>
          )}
        </div>
      </section>

      <section className="section section-alt promise" aria-labelledby="promise-title">
        <div className="wrap">
          <div className="stack">
            <p className="eyebrow">The idea</p>
            <h2 id="promise-title" className="quote">
              You have something that needs doing. <span>Call {name}. She&apos;ll figure it out.</span>
            </h2>
          </div>
          <div className="copy">
            <p>
              Most people don&apos;t need a dog walker, a driver, a personal shopper and a house sitter. They need one reliable
              person who can handle whatever comes up this week, and who already knows how they like things done.
            </p>
            <p>
              Need a used fridge found by Friday, a Marketplace pickup in Burnaby, or someone to wait for the plumber while
              you&apos;re at work? That&apos;s the kind of thing {name} sorts out.
            </p>
            {owner && (owner.bio || owner.photoUrl) && (
              <div className="meet">
                <Avatar name={owner.displayName} photoUrl={owner.photoUrl} large />
                <div className="stack" style={{ gap: "0.5rem" }}>
                  <h3>Meet {owner.displayName}</h3>
                  {owner.headline && <p>{owner.headline}</p>}
                  {owner.bio && <p className="bio">{owner.bio}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="section" id="services" aria-labelledby="services-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Services</p>
            <h2 id="services-title">Everyday help, handled properly</h2>
            <p>If it&apos;s not on the list, ask anyway. Most things that need a capable pair of hands and a car are fair game.</p>
          </div>
          <div className="svc-grid">
            {serviceGroups.map((g) => (
              <div className="svc" key={g.title}>
                <h3>{g.title}</h3>
                <ul>{g.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section families" id="families" aria-labelledby="families-title">
        <div className="wrap">
          <div className="copy">
            <p className="eyebrow">Independent living</p>
            <h2 id="families-title">For parents who are doing fine, and the families who worry from afar</h2>
            <p className="pull">&ldquo;Mom doesn&apos;t need home care. She just needs someone trustworthy nearby.&rdquo;</p>
            <p>
              {name} helps older adults stay independent with a regular, familiar face. She is not a caregiver. She&apos;s the
              capable friend who drives to the store, brings the cat to the vet, helps order a new microwave and makes sure
              everything at home is okay.
            </p>
            <ul className="dots">
              <li>A standing weekly or biweekly visit at the same time</li>
              <li>Shopping, pharmacy pickups and appointments</li>
              <li>Small jobs around the house, like a burnt-out lightbulb</li>
              <li>A short update to you after each visit</li>
            </ul>
            <div><Link className="btn btn-brass" href="/#book" data-track="cta_click" data-track-cta="book_parent_visit" data-track-location="families">Book a visit for a parent</Link></div>
          </div>
          <div className="visit" aria-label="Example visit">
            <div className="visit-head"><span className="t">Tuesday with Mom</span><span className="d">Example visit · 3 hours</span></div>
            <ol>
              {familyVisit.map(([t, what]) => <li key={t}><time>{t}</time><span>{what}</span></li>)}
            </ol>
            <p className="visit-foot">Every visit ends with a quick note to the family, so you always know how it went.</p>
          </div>
        </div>
      </section>

      <section className="section" id="how" aria-labelledby="how-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">How it works</p>
            <h2 id="how-title">Three steps, then it&apos;s off your plate</h2>
          </div>
          <div className="steps">
            <div className="step"><span className="step-n">1</span><h3>Pick a time</h3><p>Choose what you need, how long and an open time on {name}&apos;s calendar. A one-off errand or a regular weekly slot both work.</p></div>
            <div className="step"><span className="step-n">2</span><h3>Share the details</h3><p>Add notes, preferences and access instructions. You get a confirmation by email right away.</p></div>
            <div className="step"><span className="step-n">3</span><h3>Consider it done</h3><p>{name} takes care of it personally and sends a short update, with receipts for anything she bought for you.</p></div>
          </div>
        </div>
      </section>

      <section className="section section-alt rates" id="rates" aria-labelledby="rates-title">
        <div className="wrap">
          <div className="rate-card panel">
            <p className="eyebrow">Rates</p>
            {rate ? (
              <p className="price"><span className="amt">{rate}</span><span className="per">/ hour</span></p>
            ) : (
              <p className="price"><span className="per">Hourly pricing</span></p>
            )}
            <p className="muted">Simple hourly pricing for every service.</p>
            <dl className="terms">
              <div><dt>Minimum booking</dt><dd>1 hour</dd></div>
              <div><dt>Longer visits</dt><dd>Book up to {Math.max(...brand.lengths)} hours at a time</dd></div>
              {stay && <div><dt>Overnight house &amp; pet sitting</dt><dd>{money(stay.rateCents)} a night, staying at your home</dd></div>}
              <div><dt>Driving outside New West &amp; Burnaby</dt><dd>Mileage extra</dd></div>
              <div><dt>Purchases made for you</dt><dd>At cost, with receipt</dd></div>
            </dl>
          </div>
          <div className="stack">
            <h2 id="rates-title" style={{ fontSize: "var(--step-2)" }}>Regular visits</h2>
            <p className="muted">
              Many clients book a standing time: two hours every Tuesday for a parent, a weekly grocery run, or recurring dog
              walks. Regular clients get first call on {name}&apos;s calendar.
            </p>
            <h3>Payment</h3>
            <p className="muted">Nothing is charged when you book. You pay after each visit.</p>
            <h3>What {name} doesn&apos;t do</h3>
            <p className="muted">To keep things clear and safe, this is a non-medical service. For these, {name} is happy to point you to the right professional.</p>
            <ul className="not-list">{notIncluded.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="trust-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Peace of mind</p>
            <h2 id="trust-title">Someone you can hand your keys to</h2>
          </div>
          <div className="trust-grid">
            <div className="trust-item"><h3>Careful with keys</h3><p>Keys are labelled by code, never by address, and returned whenever you ask.</p></div>
            <div className="trust-item"><h3>Clear terms</h3><p>Written terms for cancellations, purchases, rides and home access.</p></div>
          </div>
        </div>
      </section>

      <section className="section faq" id="faq" aria-labelledby="faq-title">
        <div className="wrap">
          <div className="section-head">
            <p className="eyebrow">Questions</p>
            <h2 id="faq-title">Good to know</h2>
          </div>
          <div className="faq-list">
            {faqs(name, brand.cancelFreeHours).map((f) => (
              <details key={f.q}><summary>{f.q}</summary><p>{f.a}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="section contact" id="contact" aria-labelledby="contact-title">
        <div className="wrap">
          <div className="copy">
            <p className="eyebrow">Get in touch</p>
            <h2 id="contact-title">Prefer to call or text?</h2>
            <p>Not sure what to book, or need something today? Get in touch directly.</p>
          </div>
          <dl className="contact-lines">
            <div className="contact-line"><dt className="lbl">Phone</dt><dd className="val"><a href={telHref(phone)} data-track-location="contact">{phone}</a></dd></div>
            <div className="contact-line"><dt className="lbl">Email</dt><dd className="val"><a href={`mailto:${brand.email}`} data-track-location="contact">{brand.email}</a></dd></div>
            <div className="contact-line"><dt className="lbl">Hours</dt><dd className="val">{brand.hours}</dd></div>
          </dl>
        </div>
      </section>
    </>
  );
}
