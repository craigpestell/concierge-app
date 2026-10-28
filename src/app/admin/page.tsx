import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { cancelBooking } from "@/lib/booking-actions";
import { money, whenLabel, slugify } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";
import { getOwnerProfile } from "@/lib/owner";

export const metadata: Metadata = { title: "Admin" };

const admin = () => requireUser(["ADMIN"], "/admin");

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
  const [owner, bookings, services] = await Promise.all([
    getOwnerProfile(),
    db.booking.findMany({ where: { end: { gt: now }, status: "CONFIRMED" }, include: { customer: true, service: true }, orderBy: { start: "asc" }, take: 200 }),
    db.service.findMany({ orderBy: { sort: "asc" } }),
  ]);

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="stack" style={{ gap: "0.4rem" }}>
          <p className="eyebrow">Admin</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>{brand.name}</h1>
        </div>
        {error && <p className="notice error" role="alert">{error}</p>}

        {!owner && (
          <p className="notice">Your booking page isn't set up yet. <Link href="/concierge/setup">Set up your profile</Link> to open your calendar.</p>
        )}

        <div className="panel" id="bookings">
          <h2 style={{ fontSize: "var(--step-2)" }}>Upcoming bookings</h2>
          {bookings.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Customer</th><th>Service</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{whenLabel(b.start, b.end)}<div className="muted small">{b.address}</div></td>
                      <td>{b.customer.name}<div className="muted small">{b.customer.email}</div></td>
                      <td>{b.service.name}<div className="muted small">{money(b.priceCents)}</div></td>
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
