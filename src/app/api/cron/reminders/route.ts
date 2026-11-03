import { NextResponse } from "next/server";
import { bearerMatches } from "@/lib/bearer";
import { sendDueReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";

/**
 * Sends due booking reminders. On Vercel there's no long-running server for the timer in
 * instrumentation.ts, so Vercel Cron calls this every 15 minutes (vercel.json) with CRON_SECRET.
 */
export async function GET(req: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!bearerMatches(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401, headers });
  }
  const sent = await sendDueReminders();
  return NextResponse.json({ sent }, { headers });
}
