import type { ReactNode } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { DashHeader } from "@/components/DashHeader";
import { DashTabs } from "@/components/DashTabs";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(undefined, "/account");
  const now = new Date();
  const [upcoming, past] = await Promise.all([
    db.booking.count({ where: { customerId: user.id, status: "CONFIRMED", start: { gt: now } } }),
    db.booking.count({ where: { customerId: user.id, OR: [{ status: { not: "CONFIRMED" } }, { start: { lte: now } }] } }),
  ]);

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="dash-top">
          <DashHeader eyebrow={`Signed in as ${user.email}`} title="My bookings">
            <Link className="btn btn-sm" href="/#book">Book a time</Link>
            <form action="/auth/signout" method="post"><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </DashHeader>
          <DashTabs
            label="My bookings"
            tabs={[
              { href: "/account", label: "Upcoming", count: upcoming },
              { href: "/account/past", label: "Past and cancelled", count: past },
            ]}
          />
        </div>
        {children}
      </div>
    </section>
  );
}
