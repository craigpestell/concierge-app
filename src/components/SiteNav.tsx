"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Props = {
  user: { hasProfile: boolean; isAdmin: boolean } | null;
};

// Main navigation. Wide screens show every link inline; narrower screens fold them into a menu button.
export function SiteNav({ user }: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <nav className="nav" aria-label="Main">
      <div className="nav-links" id="site-menu" data-open={open} onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}>
        <Link href="/#services">Services</Link>
        <Link href="/#families">For families</Link>
        <Link href="/#rates">Rates</Link>
        <Link href="/#faq">FAQ</Link>
        {user ? (
          <>
            {user.hasProfile && <Link href="/concierge">My schedule</Link>}
            {user.isAdmin && <Link href="/admin">Admin</Link>}
            <Link href="/account">Account</Link>
          </>
        ) : (
          <Link href="/signin">Sign in</Link>
        )}
        <Link className="btn nav-menu-book" href="/#book">Book a time</Link>
      </div>
      <Link className="btn btn-sm nav-book" href="/#book">Book a time</Link>
      <button type="button" className="nav-toggle" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
        <span className="nav-toggle-bars" aria-hidden="true" />
        <span className="nav-toggle-label">{open ? "Close" : "Menu"}</span>
      </button>
    </nav>
  );
}
