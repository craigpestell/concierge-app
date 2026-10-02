import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { cancelBooking } from "@/lib/booking-actions";
import { money, whenLabel } from "@/lib/format";
import { StatusPill } from "@/components/StatusPill";

export const metadata: Metadata = { title: "My bookings" };

async function cancel(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id"));
  const b = await db.booking.findFirst({ where: { id, customerId: user.id, status: "CONFIRMED", start: { gt: new Date() } } });
  if (b) await cancelBooking(b.id, "customer");
  revalidatePath("/account");
}

export default async function AccountPage() {
  const user = await requireUser(undefined, "/account");
  const bookings = await db.booking.findMany({
    where: { customerId: user.id },
    include: { concierge: true, service: true },
    orderBy: { start: "desc" },
    take: 50,
  });
  const now = new Date();
  const upcoming = bookings.filter((b) => b.start > now && b.status === "CONFIRMED").reverse();
  const past = bookings.filter((b) => !(b.start > now && b.status === "CONFIRMED"));

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="panel-head">
          <div className="stack" style={{ gap: "0.4rem" }}>
            <p className="eyebrow">Signed in as {user.email}</p>
            <h1 style={{ fontSize: "var(--step-3)" }}>My bookings</h1>
          </div>
          <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
        </div>

        <div className="panel">
          <h2 style={{ fontSize: "var(--step-2)" }}>Upcoming</h2>
          {upcoming.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Service</th><th>Concierge</th><th>Estimate</th><th></th></tr></thead>
                <tbody>
                  {upcoming.map((b) => {
                    const late = b.start.getTime() - now.getTime() < brand.cancelFreeHours * 3600_000;
                    return (
                      <tr key={b.id}>
                        <td>{whenLabel(b.start, b.end)}<div className="muted small">{b.address}</div></td>
                        <td>{b.service.name}</td>
                        <td><Link href={`/concierges/${b.concierge.slug}`}>{b.concierge.displayName}</Link></td>
                        <td className="num">{money(b.priceCents)}</td>
                        <td>
                          <form action={cancel}>
                            <input type="hidden" name="id" value={b.id} />
                            <button className="link-btn" type="submit">Cancel</button>
                          </form>
                          {late && <div className="hint">Less than {brand.cancelFreeHours} hours away. A late-cancellation charge may apply.</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No upcoming bookings. <Link href="/concierges">Book a concierge</Link>.</p>
          )}
        </div>

        {past.length > 0 && (
          <div className="panel">
            <h2 style={{ fontSize: "var(--step-2)" }}>Past and cancelled</h2>
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Service</th><th>Concierge</th><th>Status</th><th>Visit note</th></tr></thead>
                <tbody>
                  {past.map((b) => (
                    <tr key={b.id}>
                      <td>{whenLabel(b.start, b.end)}</td>
                      <td>{b.service.name}</td>
                      <td>{b.concierge.displayName}</td>
                      <td><StatusPill status={b.status} /></td>
                      <td>{b.visitNote ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
