import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

// The public pages worth finding in search. Add a page here when it should be indexed.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${brand.url}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${brand.url}/book`, changeFrequency: "daily", priority: 0.8 },
    { url: `${brand.url}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
