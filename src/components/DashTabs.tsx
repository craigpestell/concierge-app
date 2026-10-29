"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashTab = { href: string; label: string; count?: number };

// Section tabs for the signed-in pages. Each tab is its own page, so they work without JavaScript
// and can be bookmarked; this only marks the current one. Narrow screens scroll the row sideways.
export function DashTabs({ tabs, label }: { tabs: DashTab[]; label: string }) {
  const path = usePathname();
  return (
    <nav className="tabs" aria-label={label}>
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className="tab" aria-current={path === t.href ? "page" : undefined}>
          {t.label}
          {t.count ? <span className="tab-count">{t.count}</span> : null}
        </Link>
      ))}
    </nav>
  );
}
