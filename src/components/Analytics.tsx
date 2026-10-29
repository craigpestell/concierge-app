"use client";

import Script from "next/script";
import { useEffect, useState } from "react";
import { eventForClick } from "@/lib/analytics";

const CONSENT_KEY = "rcc-analytics-consent";
type Choice = "granted" | "denied";

function readChoice(): Choice | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null;
  }
}

// Loads GA4 with Consent Mode: no analytics cookies until the visitor accepts.
// Until then Google only gets cookieless, anonymous pings.
export function Analytics({ id }: { id: string }) {
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!readChoice()) setAsking(true);
    const reopen = () => setAsking(true);
    window.addEventListener("rcc:cookie-settings", reopen);

    const onClick = (e: MouseEvent) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>("a, button");
      if (!el || !window.gtag) return;
      const hit = eventForClick({ href: el.getAttribute("href"), dataset: { ...el.dataset } });
      if (hit) window.gtag("event", hit.name, hit.params);
    };
    document.addEventListener("click", onClick, { capture: true });
    return () => {
      window.removeEventListener("rcc:cookie-settings", reopen);
      document.removeEventListener("click", onClick, { capture: true });
    };
  }, []);

  function choose(choice: Choice) {
    try {
      localStorage.setItem(CONSENT_KEY, choice);
    } catch {}
    window.gtag?.("consent", "update", { analytics_storage: choice });
    setAsking(false);
  }

  return (
    <>
      <Script id="ga-init" strategy="afterInteractive">{`
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
var c = null; try { c = localStorage.getItem(${JSON.stringify(CONSENT_KEY)}); } catch (e) {}
gtag('consent', 'default', { analytics_storage: c === 'granted' ? 'granted' : 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
gtag('js', new Date());
gtag('config', ${JSON.stringify(id)});
`}</Script>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${id}`} strategy="afterInteractive" />
      {asking && (
        <div className="consent" role="region" aria-label="Cookie choice">
          <p>
            We&apos;d like to use Google Analytics cookies to see how people find and use this site. Nothing is used for
            advertising. <a href="/privacy">Privacy</a>
          </p>
          <div className="actions">
            <button className="btn btn-sm" type="button" onClick={() => choose("granted")}>Accept</button>
            <button className="btn btn-sm btn-ghost" type="button" onClick={() => choose("denied")}>Decline</button>
          </div>
        </div>
      )}
    </>
  );
}

export function CookieSettingsButton() {
  return (
    <button className="link-button" type="button" onClick={() => window.dispatchEvent(new Event("rcc:cookie-settings"))}>
      Cookie settings
    </button>
  );
}
