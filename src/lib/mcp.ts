// The MCP server behind /mcp. It lets the site owner manage her own site data from an AI app
// (Claude, ChatGPT, ...): profile, rates, services, hours, time off, business phone and bookings.
// It can't touch code, design or deploys. Each request builds a fresh server bound to the signed-in
// owner (see src/app/mcp/route.ts), and every tool goes through the same checks as the web pages.
import { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";
import type { ConciergeProfile, Prisma, User } from "@prisma/client";
import { db } from "./db";
import { brand } from "./brand";
import { appUrl } from "./auth";
import { features } from "./features";
import { bookingWhen, money } from "./format";
import { formatPhone } from "./phone";
import { AREAS, validateProfile } from "./profile-form";
import { localDate, minutesLabel } from "./time";
import {
  addService,
  addTimeOff,
  cancelOwnBooking,
  clearBusinessPhone,
  createProfile,
  EditError,
  markBookingDone,
  removeTimeOff,
  setBusinessPhone,
  setServiceActive,
  setWeeklyHours,
  updateProfile,
  WEEKDAYS,
} from "./site-edits";

type Owner = User & { profile: ConciergeProfile | null };

const INSTRUCTIONS = `You are helping the owner of ${brand.name}, a personal concierge, house sitting and pet sitting business in ${brand.area}, manage her website at ${appUrl()}.
Start with get_site to see what's set up. Money is in Canadian dollars. Dates are YYYY-MM-DD and times are 24-hour HH:MM, both in ${brand.timeZone}.
Changes go live on the public site straight away, so confirm what you're about to change with her first, and read the result back. Cancelling a booking or marking it done emails the client, so always confirm those first.
You can't change the site's code, design or page wording. If she asks for that, tell her to ask whoever looks after the website.`;

/** Tool results are JSON text, which every MCP client shows and every model can read. */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function fail(message: string) {
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/** Runs a tool body, turning EditErrors (bad input, missing records) into readable tool errors. */
async function run(fn: () => Promise<unknown>) {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof EditError) return fail(e.message);
    console.error("mcp tool failed", e);
    return fail("Something went wrong on the server. Nothing may have been saved; check with get_site.");
  }
}

const hhmm = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM, for example 09:00 or 17:30");
const toMinutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h! * 60 + m!;
};
const toHHMM = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const weekday = z.enum(WEEKDAYS as [string, ...string[]]);

/** Finds services by id, slug or name (case-insensitive). Throws listing what didn't match. */
async function resolveServices(refs: string[]) {
  const all = await db.service.findMany();
  const ids: string[] = [];
  const missing: string[] = [];
  for (const ref of refs) {
    const r = ref.trim().toLowerCase();
    const s = all.find((x) => x.id === ref || x.slug === r || x.name.toLowerCase() === r);
    if (s) ids.push(s.id);
    else missing.push(ref);
  }
  if (missing.length) throw new EditError(`Unknown service: ${missing.join(", ")}. Use list_services to see the names, or add_service to create one.`);
  return [...new Set(ids)];
}

async function siteOverview(owner: Owner) {
  const p = owner.profile ? await db.conciergeProfile.findUnique({ where: { id: owner.profile.id }, include: { services: { include: { service: true } }, availability: true } }) : null;
  if (!p) {
    return {
      setUp: false,
      next: owner.role === "ADMIN" ? "No profile yet. Use set_up_profile to create it." : "No profile yet, and only an admin account can create one.",
      account: { email: owner.email, role: owner.role },
    };
  }
  const now = new Date();
  const [timeOff, upcoming, toCloseOut] = await Promise.all([
    db.timeOff.findMany({ where: { conciergeId: p.id, end: { gt: now } }, orderBy: { start: "asc" } }),
    db.booking.count({ where: { conciergeId: p.id, status: "CONFIRMED", start: { gt: now } } }),
    db.booking.count({ where: { conciergeId: p.id, status: "CONFIRMED", start: { lte: now } } }),
  ]);
  return {
    setUp: true,
    account: { email: owner.email, role: owner.role },
    publicPages: { home: appUrl(), booking: `${appUrl()}/book` },
    profile: {
      name: p.displayName,
      headline: p.headline,
      bio: p.bio,
      photoUrl: p.photoUrl,
      takingBookings: p.visible,
      areas: p.areas,
      areasAllowed: AREAS,
      services: p.services.map((s) => s.service.name),
    },
    rates: {
      hourly: p.hourlyRateCents / 100,
      overnight: features.stays()
        ? { perNight: p.nightlyRateCents != null ? p.nightlyRateCents / 100 : null, meaning: "Flat fee for the roughly 8 sleeping hours of each night of a house or pet sitting stay; waking hours of care are charged at the hourly rate. Null means stays aren't offered online." }
        : "Overnight stays are switched off on the site.",
    },
    businessPhone: p.businessPhone ? formatPhone(p.businessPhone) : `Not set; the site shows the placeholder ${brand.phone}.`,
    weeklyHours: [...p.availability].sort((a, b) => a.weekday - b.weekday).map((a) => ({ day: WEEKDAYS[a.weekday], start: toHHMM(a.startMin), end: toHHMM(a.endMin), label: `${minutesLabel(a.startMin)} to ${minutesLabel(a.endMin)}` })),
    timeOff: timeOff.map(timeOffJson),
    bookings: { upcoming, toCloseOut },
  };
}

function timeOffJson(t: { id: string; start: Date; end: Date; note: string | null }) {
  return { id: t.id, from: localDate(t.start, brand.timeZone), to: localDate(new Date(t.end.getTime() - 1), brand.timeZone), note: t.note };
}

type BookingRow = Prisma.BookingGetPayload<{ include: { customer: true; service: true } }>;

function bookingJson(b: BookingRow) {
  return {
    id: b.id,
    status: b.status,
    kind: b.kind === "STAY" ? "overnight stay" : "visit",
    when: bookingWhen(b),
    start: b.start.toISOString(),
    end: b.end.toISOString(),
    service: b.service.name,
    hours: b.hours,
    nights: b.nights,
    estimate: money(b.priceCents),
    client: { name: b.customer.name, email: b.customer.email, phone: b.customer.phone },
    address: b.address,
    notes: b.notes,
    visitNote: b.visitNote,
  };
}

/** Builds the MCP server for one request, bound to the signed-in owner. */
export function buildMcpServer(owner: Owner) {
  const server = new McpServer({ name: `${brand.name} site`, version: "1.0.0" }, { instructions: INSTRUCTIONS });
  const isAdmin = owner.role === "ADMIN";

  const needProfile = () => {
    if (!owner.profile) throw new EditError("There's no profile yet. Use set_up_profile first.");
    return owner.profile;
  };
  const needAdmin = () => {
    if (!isAdmin) throw new EditError("Only an admin account can change the list of services.");
  };
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  const edits = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

  server.registerTool(
    "get_site",
    { title: "Get site overview", description: "Her profile, rates, services, service areas, business phone, weekly hours, upcoming time off and booking counts. Call this first.", annotations: readOnly },
    () => run(() => siteOverview(owner)),
  );

  server.registerTool(
    "list_services",
    { title: "List services", description: "Every service on the booking menu, whether it's shown to clients, and whether she offers it.", annotations: readOnly },
    () =>
      run(async () => {
        const [all, mine] = await Promise.all([
          db.service.findMany({ orderBy: { sort: "asc" } }),
          owner.profile ? db.conciergeService.findMany({ where: { conciergeId: owner.profile.id } }) : [],
        ]);
        const offered = new Set(mine.map((m) => m.serviceId));
        return all.map((s) => ({ id: s.id, name: s.name, shownOnSite: s.active, sheOffersIt: offered.has(s.id) }));
      }),
  );

  const profileFields = {
    headline: z.string().max(140).optional().describe("One-line introduction shown under her name"),
    bio: z.string().max(2000).optional().describe("The About section on the home and booking pages"),
    photoUrl: z.string().optional().describe("https:// link to a square photo, or an empty string for none"),
    hourlyRate: z.number().min(20).max(200).optional().describe("Hourly rate in dollars, for visits, errands and rides"),
    overnightRate: z
      .number()
      .min(20)
      .max(1000)
      .nullable()
      .optional()
      .describe("Overnight stays: flat fee in dollars for the ~8 sleeping hours of each night (waking hours are billed hourly). null stops offering stays online."),
    areas: z.array(z.enum(AREAS as [string, ...string[]])).min(1).optional().describe("Service areas"),
    services: z.array(z.string()).min(1).optional().describe("Services she offers, by name or id (see list_services). Replaces the current list."),
  };

  server.registerTool(
    "set_up_profile",
    {
      title: "Set up her profile",
      description: "Creates her public profile when there isn't one yet (admin accounts only). Starts with weekday hours of 9 to 5.",
      inputSchema: z.object({ name: z.string().min(1).max(80).describe("The name clients see"), ...profileFields }),
      annotations: { ...edits, idempotentHint: false },
    },
    (a) =>
      run(async () => {
        if (!isAdmin) throw new EditError("Only an admin account can create the profile.");
        if (owner.profile) throw new EditError("The profile already exists. Use update_profile.");
        const serviceIds = a.services ? await resolveServices(a.services) : [];
        const v = validateProfile(
          { displayName: a.name, headline: a.headline ?? "", bio: a.bio ?? "", photoUrl: a.photoUrl ?? "", rate: a.hourlyRate ?? 50, nightlyRate: a.overnightRate ?? null, areas: a.areas ?? [...AREAS], serviceIds },
          features.stays(),
        );
        if ("error" in v) throw new EditError(v.error);
        owner.profile = await createProfile(owner.id, v.value);
        return { done: "Profile created and published.", site: await siteOverview(owner) };
      }),
  );

  server.registerTool(
    "update_profile",
    {
      title: "Update profile and rates",
      description: "Changes any of her profile fields. Leave a field out to keep it as it is.",
      inputSchema: z.object({
        name: z.string().min(1).max(80).optional().describe("The name clients see"),
        ...profileFields,
        takingBookings: z.boolean().optional().describe("false hides her booking page and pauses new bookings; existing bookings stay"),
      }),
      annotations: edits,
    },
    (a) =>
      run(async () => {
        const p = await db.conciergeProfile.findUniqueOrThrow({ where: { id: needProfile().id }, include: { services: true } });
        const serviceIds = a.services ? await resolveServices(a.services) : p.services.map((s) => s.serviceId);
        const stays = features.stays();
        const v = validateProfile(
          {
            displayName: a.name ?? p.displayName,
            headline: a.headline ?? p.headline,
            bio: a.bio ?? p.bio,
            photoUrl: a.photoUrl ?? p.photoUrl ?? "",
            rate: a.hourlyRate ?? p.hourlyRateCents / 100,
            nightlyRate: a.overnightRate === undefined ? undefined : a.overnightRate,
            areas: a.areas ?? p.areas,
            serviceIds,
          },
          stays,
        );
        if ("error" in v) throw new EditError(v.error);
        // Undefined in the result means "keep" for the nightly rate; keep the saved one explicitly.
        const value = { ...v.value, nightlyRateCents: v.value.nightlyRateCents === undefined ? p.nightlyRateCents : v.value.nightlyRateCents };
        await updateProfile(p, value, a.takingBookings ?? p.visible);
        return {
          done: "Saved. The public site shows the change now.",
          ...(a.overnightRate !== undefined && !stays ? { note: "Overnight stays are switched off on the site, so the overnight rate was not changed." } : {}),
          site: await siteOverview(owner),
        };
      }),
  );

  server.registerTool(
    "set_weekly_hours",
    {
      title: "Set weekly hours",
      description: "Replaces her weekly hours for visits. Days left out are days off. Times are on the half hour between 06:00 and 21:00. Overnight stays aren't limited by these hours.",
      inputSchema: z.object({ days: z.array(z.object({ day: weekday, start: hhmm, end: hhmm })).max(7) }),
      annotations: edits,
    },
    ({ days }) =>
      run(async () => {
        const rows = await setWeeklyHours(
          needProfile().id,
          days.map((d) => ({ weekday: WEEKDAYS.indexOf(d.day), startMin: toMinutes(d.start), endMin: toMinutes(d.end) })),
        );
        return { done: "Hours saved.", weeklyHours: rows.map((r) => ({ day: WEEKDAYS[r.weekday], start: toHHMM(r.startMin), end: toHHMM(r.endMin) })) };
      }),
  );

  server.registerTool(
    "add_time_off",
    {
      title: "Add time off",
      description: "Blocks whole days so clients can't book them. Existing bookings on those days are not cancelled.",
      inputSchema: z.object({ from: date, to: date.optional().describe("Last day off, inclusive. Defaults to the same day."), note: z.string().max(140).optional().describe("Private note, only she sees it") }),
      annotations: { ...edits, idempotentHint: false },
    },
    (a) => run(async () => ({ done: "Time off added.", timeOff: timeOffJson(await addTimeOff(needProfile().id, a.from, a.to, a.note)) })),
  );

  server.registerTool(
    "remove_time_off",
    { title: "Remove time off", description: "Removes a block of time off by its id (from get_site).", inputSchema: z.object({ id: z.string() }), annotations: edits },
    ({ id }) =>
      run(async () => {
        await removeTimeOff(needProfile().id, id);
        return { done: "Time off removed." };
      }),
  );

  server.registerTool(
    "set_business_phone",
    {
      title: "Set business phone",
      description: "Sets the business number shown on the site and in emails. A 10-digit North American number.",
      inputSchema: z.object({ phone: z.string(), provider: z.enum(["fongo", "textnow", "other"]).optional().describe("Which free phone service the line is on") }),
      annotations: edits,
    },
    (a) => run(async () => ({ done: "Number saved.", businessPhone: formatPhone(await setBusinessPhone(needProfile().id, a.phone, a.provider)) })),
  );

  server.registerTool(
    "clear_business_phone",
    { title: "Clear business phone", description: `Stops showing a business number; the site goes back to the placeholder ${brand.phone}.`, annotations: edits },
    () =>
      run(async () => {
        await clearBusinessPhone(needProfile().id);
        return { done: "Business number removed." };
      }),
  );

  server.registerTool(
    "add_service",
    {
      title: "Add a service",
      description: "Adds a service to the booking menu (admin accounts only), or shows it again if it was hidden. Then use update_profile to say she offers it.",
      inputSchema: z.object({ name: z.string().min(1).max(60) }),
      annotations: edits,
    },
    ({ name }) =>
      run(async () => {
        needAdmin();
        const s = await addService(name);
        return { done: `"${s.name}" is on the booking menu.`, service: { id: s.id, name: s.name } };
      }),
  );

  server.registerTool(
    "set_service_shown",
    {
      title: "Show or hide a service",
      description: "Shows or hides a service on the booking page (admin accounts only). Hidden services stay on past bookings.",
      inputSchema: z.object({ service: z.string().describe("Service name or id"), shown: z.boolean() }),
      annotations: edits,
    },
    (a) =>
      run(async () => {
        needAdmin();
        const [id] = await resolveServices([a.service]);
        await setServiceActive(id!, a.shown);
        return { done: a.shown ? "Service shown." : "Service hidden." };
      }),
  );

  server.registerTool(
    "list_bookings",
    {
      title: "List bookings",
      description: "Her bookings with client contact details. 'upcoming' = confirmed and not started; 'to_close_out' = started but not marked done; 'past' = done or cancelled in the last 60 days.",
      inputSchema: z.object({ which: z.enum(["upcoming", "to_close_out", "past"]).default("upcoming"), limit: z.number().int().min(1).max(100).default(25) }),
      annotations: readOnly,
    },
    ({ which, limit }) =>
      run(async () => {
        const now = new Date();
        const where: Prisma.BookingWhereInput =
          which === "upcoming"
            ? { status: "CONFIRMED", start: { gt: now } }
            : which === "to_close_out"
              ? { status: "CONFIRMED", start: { lte: now } }
              : { status: { in: ["DONE", "CANCELLED"] }, start: { gt: new Date(now.getTime() - 60 * 86_400_000) } };
        const rows = await db.booking.findMany({
          where: { conciergeId: needProfile().id, ...where },
          include: { customer: true, service: true },
          orderBy: { start: which === "past" ? "desc" : "asc" },
          take: limit,
        });
        return rows.map(bookingJson);
      }),
  );

  server.registerTool(
    "mark_booking_done",
    {
      title: "Mark a booking done",
      description: "Closes out a confirmed booking. Emails the client, with the note if given. Confirm with her first.",
      inputSchema: z.object({ bookingId: z.string(), note: z.string().max(2000).optional().describe("Visit or stay note emailed to the client") }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    (a) => run(async () => ({ done: "Marked done and the client was emailed.", booking: bookingJson(await markBookingDone(needProfile(), owner.email, a.bookingId, a.note)) })),
  );

  server.registerTool(
    "cancel_booking",
    {
      title: "Cancel a booking",
      description: "Cancels one of her confirmed bookings. The client is emailed an apology. This can't be undone, so confirm with her first.",
      inputSchema: z.object({ bookingId: z.string() }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: true },
    },
    ({ bookingId }) =>
      run(async () => {
        const b = await cancelOwnBooking(needProfile(), bookingId);
        return { done: "Cancelled and the client was emailed.", booking: bookingJson(b) };
      }),
  );

  return server;
}
