// Changes to the site data she owns: profile, rates, services, hours, time off, phone and bookings.
// Shared by the signed-in pages under /concierge and /admin and by the MCP server (src/lib/mcp.ts),
// so both apply the same checks. Each function throws EditError with a message fit to show her.
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { brand } from "./brand";
import { slugify } from "./format";
import { sendEmail } from "./email";
import { notifyOwners } from "./notify";
import { bookingDone, ownerDone } from "./email-templates";
import { cancelBooking } from "./booking-actions";
import { normalizePhone, providerGuide } from "./phone";
import { uniqueSlug, type ProfileInput } from "./profile-form";
import { addDays, isValidDate, zonedToInstant } from "./time";

export class EditError extends Error {}

/** The half-hour steps the hours form offers: 6 am to 9 pm. */
export const HOUR_STEPS = Array.from({ length: 31 }, (_, i) => 6 * 60 + i * 30);
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Public pages read the profile, so refresh them after a change. Safe outside a request (tests). */
function refreshSite(path = "/") {
  try {
    revalidatePath(path, "layout");
  } catch {
    // Not inside a Next.js request.
  }
}

export const DEFAULT_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));

export async function createProfile(userId: string, v: ProfileInput) {
  const slug = await uniqueSlug(v.displayName);
  const profile = await db.conciergeProfile.create({
    data: {
      userId,
      slug,
      displayName: v.displayName,
      headline: v.headline,
      bio: v.bio,
      photoUrl: v.photoUrl,
      hourlyRateCents: v.hourlyRateCents,
      nightlyRateCents: v.nightlyRateCents,
      areas: v.areas,
      approved: true,
      services: { create: v.serviceIds.map((serviceId) => ({ serviceId })) },
      availability: { create: DEFAULT_HOURS },
    },
  });
  refreshSite();
  return profile;
}

export async function updateProfile(profile: { id: string; slug: string; displayName: string }, v: ProfileInput, visible: boolean) {
  const known = await db.service.count({ where: { id: { in: v.serviceIds } } });
  if (known !== new Set(v.serviceIds).size) throw new EditError("One of the services doesn't exist. List them to get their ids.");
  const slug = v.displayName === profile.displayName ? profile.slug : await uniqueSlug(v.displayName, profile.id);
  await db.$transaction([
    db.conciergeService.deleteMany({ where: { conciergeId: profile.id } }),
    db.conciergeProfile.update({
      where: { id: profile.id },
      data: {
        slug,
        displayName: v.displayName,
        headline: v.headline,
        bio: v.bio,
        photoUrl: v.photoUrl,
        hourlyRateCents: v.hourlyRateCents,
        nightlyRateCents: v.nightlyRateCents,
        areas: v.areas,
        visible,
        services: { create: [...new Set(v.serviceIds)].map((serviceId) => ({ serviceId })) },
      },
    }),
  ]);
  refreshSite();
}

export type HoursRow = { weekday: number; startMin: number; endMin: number };

/** Checks a week of hours: known days, each at most once, on the half-hour grid, end after start. */
export function checkHours(rows: HoursRow[]) {
  const seen = new Set<number>();
  for (const r of rows) {
    const day = WEEKDAYS[r.weekday];
    if (!day) throw new EditError(`Unknown weekday ${r.weekday}. Use 0 (Sunday) to 6 (Saturday).`);
    if (seen.has(r.weekday)) throw new EditError(`${day} is listed twice. Give one block of hours per day.`);
    seen.add(r.weekday);
    if (!HOUR_STEPS.includes(r.startMin) || !HOUR_STEPS.includes(r.endMin)) throw new EditError(`${day}: times must be on the half hour between 6 am and 9 pm.`);
    if (r.endMin <= r.startMin) throw new EditError(`${day}: the end time must be after the start time.`);
  }
  return [...rows].sort((a, b) => a.weekday - b.weekday);
}

/** Replaces her weekly hours. Days left out are days off. */
export async function setWeeklyHours(profileId: string, rows: HoursRow[]) {
  const clean = checkHours(rows);
  await db.$transaction([
    db.availability.deleteMany({ where: { conciergeId: profileId } }),
    db.availability.createMany({ data: clean.map((r) => ({ ...r, conciergeId: profileId })) }),
  ]);
  refreshSite();
  return clean;
}

/** Blocks whole days, from `from` to `to` inclusive (YYYY-MM-DD, business time zone). */
export async function addTimeOff(profileId: string, from: string, to: string | null | undefined, note: string | null | undefined) {
  const last = to || from;
  if (!isValidDate(from) || !isValidDate(last) || last < from) throw new EditError("Choose a start date and an end date on or after it (YYYY-MM-DD).");
  const t = await db.timeOff.create({
    data: {
      conciergeId: profileId,
      start: zonedToInstant(from, 0, brand.timeZone),
      end: zonedToInstant(addDays(last, 1), 0, brand.timeZone),
      note: note?.trim().slice(0, 140) || null,
    },
  });
  refreshSite();
  return t;
}

export async function removeTimeOff(profileId: string, id: string) {
  const r = await db.timeOff.deleteMany({ where: { id, conciergeId: profileId } });
  if (!r.count) throw new EditError("No time off with that id.");
  refreshSite();
}

/** Saves the public business number. Returns its 10 digits. */
export async function setBusinessPhone(profileId: string, input: string, provider: string | null | undefined) {
  const phone = normalizePhone(input);
  if (!phone) throw new EditError("Enter the full 10-digit number, for example 778-555-0142.");
  await db.conciergeProfile.update({
    where: { id: profileId },
    data: { businessPhone: phone, phoneProvider: providerGuide(provider ?? undefined) ? provider : "other" },
  });
  refreshSite();
  return phone;
}

export async function clearBusinessPhone(profileId: string) {
  await db.conciergeProfile.update({ where: { id: profileId }, data: { businessPhone: null, phoneProvider: null } });
  refreshSite();
}

/** Adds a service to the booking menu, or shows it again if one with that name exists. */
export async function addService(rawName: string) {
  const name = rawName.trim().slice(0, 60);
  const slug = slugify(name);
  if (!name || !slug) throw new EditError("Give the service a name.");
  const max = await db.service.aggregate({ _max: { sort: true } });
  const s = await db.service.upsert({
    where: { slug },
    update: { active: true, name },
    create: { name, slug, sort: (max._max.sort ?? 0) + 1 },
  });
  refreshSite();
  return s;
}

export async function setServiceActive(id: string, active: boolean) {
  const r = await db.service.updateMany({ where: { id }, data: { active } });
  if (!r.count) throw new EditError("No service with that id.");
  refreshSite();
}

/** Closes out a booking that has started, with an optional note emailed to the client. */
export async function markBookingDone(profile: { id: string }, actorEmail: string, bookingId: string, rawNote: string | null | undefined) {
  const note = (rawNote ?? "").trim().slice(0, 2000);
  const b = await db.booking.findFirst({
    where: { id: bookingId, conciergeId: profile.id, status: "CONFIRMED" },
    include: { customer: true, service: true, concierge: true },
  });
  if (!b) throw new EditError("No confirmed booking of yours with that id.");
  const done = await db.booking.update({
    where: { id: b.id },
    data: { status: "DONE", completedAt: new Date(), visitNote: note || null },
    include: { customer: true, service: true, concierge: true },
  });
  await sendEmail({ to: done.customer.email, ...bookingDone(done, note) });
  await notifyOwners("done", ownerDone(done, note), { exclude: actorEmail });
  refreshSite("/concierge");
  return done;
}

/** Cancels one of her confirmed bookings. The client gets an apology email. */
export async function cancelOwnBooking(profile: { id: string }, bookingId: string) {
  const b = await db.booking.findFirst({ where: { id: bookingId, conciergeId: profile.id, status: "CONFIRMED" } });
  if (!b) throw new EditError("No confirmed booking of yours with that id.");
  const done = await cancelBooking(b.id, "concierge");
  refreshSite("/concierge");
  return done;
}

/** Runs an edit and returns its EditError message, or null when it worked. Other errors are rethrown. */
export async function tryEdit(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (e) {
    if (e instanceof EditError) return e.message;
    throw e;
  }
}
