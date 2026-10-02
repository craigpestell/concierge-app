import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { sendBookingEmails } from "@/lib/bookings";
import { cancelBooking } from "@/lib/booking-actions";
import { busyIntervals } from "@/lib/availability";
import { money, whenLabel, slugify } from "@/lib/format";
import { localDate } from "@/lib/time";
import { StatusPill } from "@/components/StatusPill";

export const metadata: Metadata = { title: "Admin" };

const admin = () => requireUser(["ADMIN"], "/admin");

async function setApproval(f: FormData) {
  "use server";
  await admin();
  const approved = f.get("approved") === "true";
  const p = await db.conciergeProfile.update({ where: { id: String(f.get("id")) }, data: { approved }, include: { user: true } });
  if (approved) {
    await sendEmail({
      to: p.user.email,
      subject: `You're approved on ${brand.name}`,
      text: `Hi ${p.displayName},\n\nYour profile is live and customers can now book you. Check your hours and bookings on your schedule page.`,
    });
  }
  revalidatePath("/admin");
}

async function reassign(f: FormData) {
  "use server";
  await admin();
  const id = String(f.get("id"));
  const to = String(f.get("to"));
  const b = await db.booking.findUniqueOrThrow({ where: { id } });
  const busy = await busyIntervals(to, localDate(b.start, brand.timeZone), localDate(b.end, brand.timeZone));
  if (busy.some((x) => x.start < b.end && b.start < x.end)) {
    redirect(`/admin?error=${encodeURIComponent("That concierge is already busy at that time.")}#bookings`);
  }
  await db.booking.update({ where: { id }, data: { conciergeId: to } });
  await sendBookingEmails(id);
  revalidatePath("/admin");
}

async function adminCancel(f: FormData) {
  "use server";
  await admin();
  await cancelBooking(String(f.get("id")), "admin");
  revalidatePath("/admin");
}

async function addService(f: FormData) {
  "use server";
  await admin();
  const name = String(f.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  const max = await db.service.aggregate({ _max: { sort: true } });
  await db.service.upsert({
    where: { slug: slugify(name) },
    update: { active: true, name },
    create: { name, slug: slugify(name), sort: (max._max.sort ?? 0) + 1 },
  });
  revalidatePath("/admin");
}

async function toggleService(f: FormData) {
  "use server";
  await admin();
  await db.service.update({ where: { id: String(f.get("id")) }, data: { active: f.get("active") === "true" } });
  revalidatePath("/admin");
}

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await admin();
  const { error } = await searchParams;
  const now = new Date();
  const [concierges, bookings, services] = await Promise.all([
    db.conciergeProfile.findMany({ include: { user: true, _count: { select: { bookings: true } } }, orderBy: [{ approved: "asc" }, { createdAt: "asc" }] }),
    db.booking.findMany({ where: { end: { gt: now }, status: "CONFIRMED" }, include: { customer: true, concierge: true, service: true }, orderBy: { start: "asc" }, take: 200 }),
    db.service.findMany({ orderBy: { sort: "asc" } }),
  ]);
  const approved = concierges.filter((c) => c.approved);

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="stack" style={{ gap: "0.4rem" }}>
          <p className="eyebrow">Admin</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>{brand.name}</h1>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}

        <div className="panel">
          <h2 style={{ fontSize: "var(--step-2)" }}>Concierges</h2>
          {concierges.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Name</th><th>Email</th><th>Rate</th><th>Bookings</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {concierges.map((c) => (
                    <tr key={c.id}>
                      <td>{c.approved && c.visible ? <Link href={`/concierges/${c.slug}`}>{c.displayName}</Link> : c.displayName}<div className="muted small">{c.headline}</div></td>
                      <td>{c.user.email}</td>
                      <td className="num">{money(c.hourlyRateCents)}</td>
                      <td className="num">{c._count.bookings}</td>
                      <td>{!c.approved ? <span className="pill pill-confirmed">Waiting for approval</span> : c.visible ? <span className="pill pill-done">Live</span> : <span className="pill">Hidden by concierge</span>}</td>
                      <td>
                        <form action={setApproval}>
                          <input type="hidden" name="id" value={c.id} />
                          <input type="hidden" name="approved" value={String(!c.approved)} />
                          <button className={c.approved ? "link-btn" : "btn btn-sm"} type="submit">{c.approved ? "Unpublish" : "Approve"}</button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No concierges yet. Share the <Link href="/join">sign-up page</Link> with the people you're hiring.</p>
          )}
        </div>

        <div className="panel" id="bookings">
          <h2 style={{ fontSize: "var(--step-2)" }}>Upcoming bookings</h2>
          {bookings.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Customer</th><th>Service</th><th>Concierge</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{whenLabel(b.start, b.end)}<div className="muted small">{b.address}</div></td>
                      <td>{b.customer.name}<div className="muted small">{b.customer.email}</div></td>
                      <td>{b.service.name}<div className="muted small">{money(b.priceCents)}</div></td>
                      <td>
                        <form action={reassign} className="inline-form">
                          <input type="hidden" name="id" value={b.id} />
                          <select name="to" defaultValue={b.conciergeId} aria-label="Concierge">
                            {approved.map((c) => <option key={c.id} value={c.id}>{c.displayName}</option>)}
                          </select>
                          <button className="link-btn" type="submit">Reassign</button>
                        </form>
                      </td>
                      <td><StatusPill status={b.status} /></td>
                      <td><form action={adminCancel}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">Cancel</button></form></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No upcoming bookings.</p>
          )}
        </div>

        <div className="panel">
          <h2 style={{ fontSize: "var(--step-2)" }}>Services</h2>
          <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: "0.4rem" }}>
            {services.map((s) => (
              <li key={s.id} className="inline-form">
                <span>{s.name}</span>
                {!s.active && <span className="pill">Hidden</span>}
                <form action={toggleService}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="active" value={String(!s.active)} />
                  <button className="link-btn" type="submit">{s.active ? "Hide" : "Show"}</button>
                </form>
              </li>
            ))}
          </ul>
          <form action={addService} className="inline-form">
            <input name="name" aria-label="New service name" placeholder="New service name" required />
            <button className="btn btn-sm" type="submit">Add service</button>
          </form>
        </div>
      </div>
    </section>
  );
}
