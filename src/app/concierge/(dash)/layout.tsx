import type { ReactNode } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { myProfile } from "@/lib/my-profile";
import { DashHeader } from "@/components/DashHeader";
import { DashTabs } from "@/components/DashTabs";

// Shared frame for "My schedule": her name, a link to the public booking page, and the section tabs.
// /concierge/setup sits outside this group because it runs before a profile exists.
export default async function ScheduleLayout({ children }: { children: ReactNode }) {
  const { profile } = await myProfile();
  const toCloseOut = await db.booking.count({ where: { conciergeId: profile.id, status: "CONFIRMED", start: { lte: new Date() } } });

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="dash-top">
          <DashHeader eyebrow="My schedule" title={profile.displayName}>
            {profile.visible && <Link className="btn btn-ghost btn-sm" href="/book">View my booking page</Link>}
          </DashHeader>
          {!profile.visible && (
            <p className="notice">Your profile is hidden, so customers can&apos;t book you. <Link href="/concierge/profile#visibility">Turn bookings back on</Link>.</p>
          )}
          <DashTabs
            label="My schedule"
            tabs={[
              { href: "/concierge", label: "Bookings", count: toCloseOut },
              { href: "/concierge/availability", label: "Hours & time off" },
              { href: "/concierge/profile", label: "Profile & rates" },
              { href: "/concierge/phone", label: "Business phone" },
            ]}
          />
        </div>
        {children}
      </div>
    </section>
  );
}
