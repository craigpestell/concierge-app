import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { DashHeader } from "@/components/DashHeader";
import { DashTabs } from "@/components/DashTabs";

// Signed-in pages stay out of search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requireUser(["ADMIN"], "/admin");
  return (
    <section className="section">
      <div className="wrap dash">
        <div className="dash-top">
          <DashHeader eyebrow="Admin" title={brand.name}>
            {user.profile && <Link className="btn btn-ghost btn-sm" href="/concierge">Go to my schedule</Link>}
          </DashHeader>
          <DashTabs
            label="Admin"
            tabs={[
              { href: "/admin", label: "Bookings" },
              { href: "/admin/services", label: "Services" },
              { href: "/admin/notifications", label: "Notifications" },
              { href: "/admin/emails", label: "Emails" },
            ]}
          />
        </div>
        {children}
      </div>
    </section>
  );
}
