import { permanentRedirect } from "next/navigation";

// Old profile links (and links in earlier emails) now go to the booking page.
export default async function ConciergePage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  permanentRedirect(service ? `/book?service=${encodeURIComponent(service)}` : "/book");
}
