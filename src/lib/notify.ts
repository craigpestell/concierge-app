import { db } from "./db";
import { sendEmail } from "./email";

/** The notifications the business can send itself. Recipients pick which ones they get. */
export const notifyEvents = [
  { key: "booking", label: "New visit booked" },
  { key: "stay", label: "New overnight stay booked" },
  { key: "cancelled", label: "Booking cancelled" },
  { key: "done", label: "Visit or stay marked done" },
  // Not sent by the app: the info@ forwarding Worker reads this list from /api/internal/email-recipients.
  { key: "inbox", label: "Mail sent to info@" },
] as const;

export type NotifyEvent = (typeof notifyEvents)[number]["key"];

const eventKeys: readonly string[] = notifyEvents.map((e) => e.key);

/** Lowercased address, or null when it doesn't look like an email. */
export function normalizeEmail(raw: string) {
  const email = raw.trim().toLowerCase();
  return email.length <= 200 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

/** Keeps only known event keys, in the order notifyEvents lists them. */
export function cleanEvents(keys: string[]) {
  return eventKeys.filter((k) => keys.includes(k));
}

/**
 * Who gets `event`. With nobody configured at all, it falls back to `fallback` (her account
 * email) so a booking never goes unannounced. `exclude` drops whoever caused the event.
 */
export function recipientsFor(rows: { email: string; events: string[] }[], event: NotifyEvent, opts: { fallback?: string; exclude?: string } = {}) {
  const list = rows.length ? rows.filter((r) => r.events.includes(event)).map((r) => r.email) : opts.fallback ? [opts.fallback] : [];
  const exclude = opts.exclude?.toLowerCase();
  return [...new Set(list.map((e) => e.toLowerCase()))].filter((e) => e !== exclude);
}

/** Emails everyone on the admin's notification list who wants `event`. */
export async function notifyOwners(event: NotifyEvent, email: { subject: string; text: string }, opts: { fallback?: string; exclude?: string } = {}) {
  const rows = await db.notificationRecipient.findMany({ select: { email: true, events: true } });
  for (const to of recipientsFor(rows, event, opts)) await sendEmail({ to, ...email });
}
