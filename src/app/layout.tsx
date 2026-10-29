import type { Metadata } from "next";
import Link from "next/link";
import { Marcellus, Figtree } from "next/font/google";
import { brand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import { measurementId } from "@/lib/analytics";
import { Analytics, CookieSettingsButton } from "@/components/Analytics";
import { SiteNav } from "@/components/SiteNav";
import "./globals.css";

const display = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const gaId = measurementId();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href="/" aria-label={`${brand.name}, home`}>
              <span className="brand-mark" aria-hidden="true">{brand.monogram}</span>
              <span className="brand-name">{brand.name}</span>
            </Link>
            <SiteNav user={user ? { hasProfile: Boolean(user.profile), isAdmin: user.role === "ADMIN" } : null} />
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span className="brand-name">{brand.name}</span>
            <span>Personal concierge &amp; everyday help · {brand.area}, BC</span>
            <span>Non-medical services only</span>
            <span className="footer-links">
              <Link href="/privacy">Privacy</Link>
              {gaId && <CookieSettingsButton />}
            </span>
          </div>
        </footer>
        {gaId && <Analytics id={gaId} />}
      </body>
    </html>
  );
}
