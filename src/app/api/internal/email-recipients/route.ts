import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

function authorized(header: string | null) {
  const token = process.env.EMAIL_FORWARD_TOKEN;
  if (!token || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(token);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Who mail to info@ is forwarded to. Read by the Cloudflare Email Routing Worker
 * (rcc-email-forward) with EMAIL_FORWARD_TOKEN, so the list is edited in one place: the admin page.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(req.headers.get("authorization"))) return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  const rows = await db.notificationRecipient.findMany({ where: { events: { has: "inbox" } }, orderBy: { createdAt: "asc" }, select: { email: true } });
  return NextResponse.json({ recipients: rows.map((r) => r.email) }, { headers });
}
