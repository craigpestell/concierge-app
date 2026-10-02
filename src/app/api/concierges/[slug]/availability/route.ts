import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { openTimesByDate } from "@/lib/availability";
import { addDays, isValidDate } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const url = new URL(req.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const hours = Number(url.searchParams.get("hours"));
  if (!isValidDate(from) || !isValidDate(to) || to < from || to > addDays(from, 62)) {
    return NextResponse.json({ error: "Use from and to dates (YYYY-MM-DD), at most 62 days apart." }, { status: 400 });
  }
  if (!(brand.lengths as readonly number[]).includes(hours)) {
    return NextResponse.json({ error: `hours must be one of ${brand.lengths.join(", ")}.` }, { status: 400 });
  }
  const concierge = await db.conciergeProfile.findFirst({ where: { slug, approved: true, visible: true }, select: { id: true } });
  if (!concierge) return NextResponse.json({ error: "Concierge not found." }, { status: 404 });

  const days = await openTimesByDate(concierge.id, from, to, hours);
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
