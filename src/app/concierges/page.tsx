import { redirect } from "next/navigation";

// The site promotes one concierge, so the old directory sends people straight to booking.
export default async function ConciergesPage({ searchParams }: { searchParams: Promise<{ service?: string }> }) {
  const { service } = await searchParams;
  redirect(service ? `/book?service=${encodeURIComponent(service)}` : "/book");
}
