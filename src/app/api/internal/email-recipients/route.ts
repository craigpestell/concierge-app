import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/bearer";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Who mail to info@ is forwarded to. Read by the Cloudflare Email Routing Worker
 * (rcc-email-forward) with EMAIL_FORWARD_TOKEN, so the list is edited in one place: the admin page.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!bearerMatches(req.headers.get("authorization"), process.env.EMAIL_FORWARD_TOKEN)) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const rows = await db.notificationRecipient.findMany({ where: { events: { has: "inbox" } }, orderBy: { createdAt: "asc" }, select: { email: true } });
  return NextResponse.json({ recipients: rows.map((r) => r.email) }, { headers });
}
