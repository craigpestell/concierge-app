import type { Metadata } from "next";
import Link from "next/link";
import { Marcellus, Figtree } from "next/font/google";
import { brand } from "@/lib/brand";
import { currentUser } from "@/lib/auth";
import "./globals.css";

const display = Marcellus({ weight: "400", subsets: ["latin"], variable: "--font-display" });
const body = Figtree({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: brand.name, template: `%s · ${brand.name}` },
  description: brand.description,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link className="brand" href="/" aria-label={`${brand.name}, home`}>
              <span className="brand-mark" aria-hidden="true">{brand.monogram}</span>
              <span className="brand-name">{brand.name}</span>
            </Link>
            <nav className="nav" aria-label="Main">
              <Link className="hide-sm" href="/#how">How it works</Link>
              <Link className="hide-sm" href="/join">Become a concierge</Link>
              {user ? (
                <>
                  {user.profile && <Link href="/concierge">My schedule</Link>}
                  {user.role === "ADMIN" && <Link href="/admin">Admin</Link>}
                  <Link href="/account">Account</Link>
                </>
              ) : (
                <Link href="/signin">Sign in</Link>
              )}
              <Link className="btn btn-sm" href="/concierges">Book a concierge</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <span className="brand-name">{brand.name}</span>
            <span>Personal concierge &amp; everyday help · {brand.area}, BC</span>
            <span>Non-medical services only</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
