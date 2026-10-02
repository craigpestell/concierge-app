import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { cancelBooking } from "@/lib/booking-actions";
import { readProfileForm, uniqueSlug } from "@/lib/profile-form";
import { money, whenLabel, dayLabel } from "@/lib/format";
import { addDays, isValidDate, localDate, minutesLabel, zonedToInstant } from "@/lib/time";
import { ProfileFields } from "@/components/ProfileFields";
import { StatusPill } from "@/components/StatusPill";

export const metadata: Metadata = { title: "My schedule" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = Array.from({ length: 31 }, (_, i) => 6 * 60 + i * 30); // 6 am to 9 pm

async function myProfile() {
  const user = await requireUser(undefined, "/concierge");
  if (!user.profile) redirect("/join");
  return { user, profile: user.profile };
}

async function saveHours(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const rows: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!f.get(`on-${d}`)) continue;
    const startMin = Number(f.get(`start-${d}`));
    const endMin = Number(f.get(`end-${d}`));
    if (!TIMES.includes(startMin) || !TIMES.includes(endMin) || endMin <= startMin) {
      redirect(`/concierge?error=${encodeURIComponent(`${WEEKDAYS[d]}: the end time must be after the start time.`)}#hours`);
    }
    rows.push({ weekday: d, startMin, endMin });
  }
  await db.$transaction([
    db.availability.deleteMany({ where: { conciergeId: profile.id } }),
    db.availability.createMany({ data: rows.map((r) => ({ ...r, conciergeId: profile.id })) }),
  ]);
  revalidatePath("/concierge");
  redirect("/concierge?saved=hours#hours");
}

async function addTimeOff(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const from = String(f.get("from") ?? "");
  const to = String(f.get("to") ?? "") || from;
  if (!isValidDate(from) || !isValidDate(to) || to < from) redirect(`/concierge?error=${encodeURIComponent("Choose a start date and an end date on or after it.")}#timeoff`);
  await db.timeOff.create({
    data: {
      conciergeId: profile.id,
      start: zonedToInstant(from, 0, brand.timeZone),
      end: zonedToInstant(addDays(to, 1), 0, brand.timeZone),
      note: String(f.get("note") ?? "").trim().slice(0, 140) || null,
    },
  });
  redirect("/concierge?saved=timeoff#timeoff");
}

async function removeTimeOff(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  await db.timeOff.deleteMany({ where: { id: String(f.get("id")), conciergeId: profile.id } });
  revalidatePath("/concierge");
}

async function markDone(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const id = String(f.get("id"));
  const note = String(f.get("note") ?? "").trim().slice(0, 2000);
  const b = await db.booking.findFirst({ where: { id, conciergeId: profile.id, status: "CONFIRMED" }, include: { customer: true, service: true } });
  if (!b) return;
  await db.booking.update({ where: { id }, data: { status: "DONE", completedAt: new Date(), visitNote: note || null } });
  await sendEmail({
    to: b.customer.email,
    subject: `${profile.displayName} finished your ${b.service.name.toLowerCase()} visit`,
    text: `Hi ${b.customer.name},\n\n${profile.displayName} has finished your visit on ${whenLabel(b.start, b.end)}.${note ? `\n\nTheir note:\n${note}` : ""}\n\nThanks for booking with ${brand.name}.`,
  });
  revalidatePath("/concierge");
}

async function cancelAsConcierge(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const b = await db.booking.findFirst({ where: { id: String(f.get("id")), conciergeId: profile.id, status: "CONFIRMED" } });
  if (b) await cancelBooking(b.id, "concierge");
  revalidatePath("/concierge");
}

async function saveProfile(f: FormData) {
  "use server";
  const { profile } = await myProfile();
  const read = readProfileForm(f);
  if ("error" in read) redirect(`/concierge?error=${encodeURIComponent(read.error)}#profile`);
  const v = read.value;
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
        areas: v.areas,
        visible: f.get("visible") === "on",
        services: { create: v.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    }),
  ]);
  redirect("/concierge?saved=profile#profile");
}

export default async function ConciergeDashboard({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; welcome?: string }> }) {
  const { profile } = await myProfile();
  const sp = await searchParams;
  const now = new Date();
  const [full, services, bookings, timeOff] = await Promise.all([
    db.conciergeProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { availability: true, services: true } }),
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    db.booking.findMany({
      where: { conciergeId: profile.id, OR: [{ end: { gt: addHours(now, -72) } }, { status: "CONFIRMED" }] },
      include: { customer: true, service: true },
      orderBy: { start: "asc" },
    }),
    db.timeOff.findMany({ where: { conciergeId: profile.id, end: { gt: now } }, orderBy: { start: "asc" } }),
  ]);
  const hoursByDay = new Map(full.availability.map((a) => [a.weekday, a]));

  return (
    <section className="section">
      <div className="wrap dash">
        <div className="panel-head">
          <div className="stack" style={{ gap: "0.4rem" }}>
            <p className="eyebrow">My schedule</p>
            <h1 style={{ fontSize: "var(--step-3)" }}>{full.displayName}</h1>
          </div>
          {full.approved && full.visible && <Link className="btn btn-ghost btn-sm" href={`/concierges/${full.slug}`}>View my public profile</Link>}
        </div>

        {!full.approved && (
          <p className="notice">{sp.welcome ? "Thanks for applying. " : ""}Your profile is waiting for approval. Customers can book you once it's approved. You can set your hours in the meantime.</p>
        )}
        {full.approved && !full.visible && <p className="notice">Your profile is hidden, so customers can't book you. Turn it back on under Profile.</p>}
        {sp.error && <p className="notice error" role="alert">{sp.error}</p>}

        <div className="panel">
          <h2 style={{ fontSize: "var(--step-2)" }}>Bookings</h2>
          {bookings.length ? (
            <div className="table-wrap">
              <table>
                <thead><tr><th>When</th><th>Customer</th><th>Details</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr key={b.id}>
                      <td>{whenLabel(b.start, b.end)}<div className="muted small">{b.service.name} · {money(b.priceCents)}</div></td>
                      <td>{b.customer.name}<div className="muted small">{b.customer.phone ?? ""} {b.customer.email}</div></td>
                      <td>{b.address}{b.notes && <div className="muted small">{b.notes}</div>}{b.visitNote && <div className="small">Note: {b.visitNote}</div>}</td>
                      <td><StatusPill status={b.status} /></td>
                      <td>
                        {b.status === "CONFIRMED" && b.start <= now && (
                          <form action={markDone} className="stack" style={{ gap: "0.4rem", minWidth: 200 }}>
                            <input type="hidden" name="id" value={b.id} />
                            <div className="field"><label htmlFor={`note-${b.id}`}>Visit note for the customer</label><textarea id={`note-${b.id}`} name="note" style={{ minHeight: "4rem" }} /></div>
                            <div><button className="btn btn-sm" type="submit">Mark done</button></div>
                          </form>
                        )}
                        {b.status === "CONFIRMED" && b.start > now && (
                          <form action={cancelAsConcierge}><input type="hidden" name="id" value={b.id} /><button className="link-btn" type="submit">Cancel</button></form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">No bookings yet.</p>
          )}
        </div>

        <form action={saveHours} className="panel" id="hours">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>Weekly hours</h2>
            {sp.saved === "hours" && <span className="pill pill-done">Saved</span>}
          </div>
          <p className="muted small">Customers can book any time inside these hours that isn't already booked or marked as time off.</p>
          <div className="hours-grid">
            {WEEKDAYS.map((name, d) => {
              const h = hoursByDay.get(d);
              return (
                <div className="hours-row" key={d}>
                  <label className="check"><input type="checkbox" name={`on-${d}`} defaultChecked={Boolean(h)} /> {name}</label>
                  <select aria-label={`${name} start`} name={`start-${d}`} defaultValue={h?.startMin ?? 9 * 60}>
                    {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
                  </select>
                  <select aria-label={`${name} end`} name={`end-${d}`} defaultValue={h?.endMin ?? 17 * 60}>
                    {TIMES.slice(1).map((t) => <option key={t} value={t}>{minutesLabel(t)}</option>)}
                  </select>
                </div>
              );
            })}
          </div>
          <div><button className="btn btn-sm" type="submit">Save hours</button></div>
        </form>

        <div className="panel" id="timeoff">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>Time off</h2>
            {sp.saved === "timeoff" && <span className="pill pill-done">Added</span>}
          </div>
          {timeOff.length > 0 && (
            <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0, gap: "0.4rem" }}>
              {timeOff.map((t) => {
                const last = localDate(new Date(t.end.getTime() - 1), brand.timeZone);
                const first = localDate(t.start, brand.timeZone);
                return (
                  <li key={t.id} className="inline-form">
                    <span>{dayLabel(t.start)}{last !== first ? ` to ${dayLabel(new Date(t.end.getTime() - 1))}` : ""}{t.note ? ` · ${t.note}` : ""}</span>
                    <form action={removeTimeOff}><input type="hidden" name="id" value={t.id} /><button className="link-btn" type="submit">Remove</button></form>
                  </li>
                );
              })}
            </ul>
          )}
          <form action={addTimeOff} className="row">
            <div className="field"><label htmlFor="to-from">From</label><input id="to-from" name="from" type="date" required /></div>
            <div className="field"><label htmlFor="to-to">To (optional)</label><input id="to-to" name="to" type="date" /></div>
            <div className="field"><label htmlFor="to-note">Note (only you see this)</label><input id="to-note" name="note" /></div>
            <div style={{ alignSelf: "end" }}><button className="btn btn-sm" type="submit">Add time off</button></div>
          </form>
          <p className="hint">Existing bookings aren't cancelled by time off. Cancel them above if you need to.</p>
        </div>

        <form action={saveProfile} className="panel form" id="profile">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>Profile</h2>
            {sp.saved === "profile" && <span className="pill pill-done">Saved</span>}
          </div>
          <ProfileFields
            services={services}
            d={{ ...full, serviceIds: full.services.map((s) => s.serviceId) }}
          />
          <label className="check"><input type="checkbox" name="visible" defaultChecked={full.visible} /> Show my profile and take bookings</label>
          <div><button className="btn btn-sm" type="submit">Save profile</button></div>
        </form>
      </div>
    </section>
  );
}

function addHours(d: Date, h: number) {
  return new Date(d.getTime() + h * 3600_000);
}
