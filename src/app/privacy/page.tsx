import type { Metadata } from "next";
import { brand } from "@/lib/brand";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <section className="section">
      <div className="wrap stack" style={{ maxWidth: 680 }}>
        <p className="eyebrow">Privacy</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>How this site uses your information</h1>
        <h2 style={{ fontSize: "var(--step-1)" }}>Bookings and sign-in</h2>
        <p>
          When you book or sign in, we keep your name, email, phone number, address and booking notes so we can provide
          the service and contact you about it. We don&apos;t sell or share them.
        </p>
        <h2 style={{ fontSize: "var(--step-1)" }}>Analytics</h2>
        <p>
          With your permission, we use Google Analytics to understand how visitors find and use the site, such as which
          pages are viewed and whether a booking was finished. It sets cookies only if you choose Accept. If you decline,
          Google receives only anonymous signals without cookies. We don&apos;t send your name, email or booking details to
          Google, and we don&apos;t use analytics for advertising.
        </p>
        <p>You can change your choice at any time with Cookie settings at the bottom of every page.</p>
        <h2 style={{ fontSize: "var(--step-1)" }}>Questions</h2>
        <p>
          Email <a href={`mailto:${brand.email}`}>{brand.email}</a> to ask what we hold about you or to have it removed.
        </p>
      </div>
    </section>
  );
}
