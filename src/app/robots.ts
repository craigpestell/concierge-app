import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

// Public pages are open to every crawler. API and sign-in link routes are kept out of the crawl.
// Signed-in pages (/admin, /account, /concierge, /signin) are left crawlable on purpose: they send
// noindex, and Google only sees that tag if it is allowed to fetch the page.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/auth/"],
      },
    ],
    sitemap: `${brand.url}/sitemap.xml`,
    host: brand.url,
  };
}
