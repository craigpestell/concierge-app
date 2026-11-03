import { brand } from "./brand";

/**
 * schema.org LocalBusiness data for the home page, so search engines can show the business with its
 * service area, rate and contact details. It is a service-area business with no public street address,
 * so the address names the city only. Placeholder phone numbers are left out.
 */
export function businessJsonLd(opts: { phone: string | null; rateCents: number | null; services: string[] }) {
  const cities = ["New Westminster", "Burnaby"];
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${brand.url}/#business`,
    name: brand.name,
    description: brand.description,
    url: `${brand.url}/`,
    image: `${brand.url}/opengraph-image`,
    logo: `${brand.url}/icon.svg`,
    email: brand.email,
    ...(opts.phone ? { telephone: opts.phone } : {}),
    priceRange: "$$$",
    currenciesAccepted: "CAD",
    address: { "@type": "PostalAddress", addressLocality: "New Westminster", addressRegion: "BC", addressCountry: "CA" },
    areaServed: cities.map((name) => ({ "@type": "City", name, containedInPlace: { "@type": "AdministrativeArea", name: "British Columbia" } })),
    knowsAbout: opts.services,
    ...(opts.rateCents
      ? {
          makesOffer: opts.services.map((name) => ({
            "@type": "Offer",
            itemOffered: { "@type": "Service", name, areaServed: cities.join(" and ") },
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: (opts.rateCents! / 100).toFixed(2),
              priceCurrency: "CAD",
              unitCode: "HUR",
            },
          })),
        }
      : {}),
  };
}

/** Serialises JSON-LD for a <script> tag, escaping "<" so text in it can't close the tag. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
