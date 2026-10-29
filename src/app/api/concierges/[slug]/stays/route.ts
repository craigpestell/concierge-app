import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { blockedStayDates } from "@/lib/availability";
import { features } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Days in the booking window that an overnight stay can't include. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!features.stays()) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const { slug } = await params;
  const concierge = await db.conciergeProfile.findFirst({
    where: { slug, approved: true, visible: true, nightlyRateCents: { not: null } },
    select: { id: true },
  });
  if (!concierge) return NextResponse.json({ error: "Concierge not found." }, { status: 404 });

  const blocked = await blockedStayDates(concierge.id);
  return NextResponse.json({ blocked }, { headers: { "Cache-Control": "no-store" } });
}
