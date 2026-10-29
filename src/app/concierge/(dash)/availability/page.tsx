import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { dayLabel } from "@/lib/format";
import { myProfile } from "@/lib/my-profile";
import { addDays, isValidDate, localDate, minutesLabel, zonedToInstant } from "@/lib/time";

export const metadata: Metadata = { title: "Hours & time off" };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = Array.from({ length: 31 }, (_, i) => 6 * 60 + i * 30); // 6 am to 9 pm
const HERE = "/concierge/availability";

async function saveHours(f: FormData) {
  "use server";
  const { profile } = await myProfile(HERE);
  const rows: { weekday: number; startMin: number; endMin: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!f.get(`on-${d}`)) continue;
    const startMin = Number(f.get(`start-${d}`));
    const endMin = Number(f.get(`end-${d}`));
    if (!TIMES.includes(startMin) || !TIMES.includes(endMin) || endMin <= startMin) {
      redirect(`${HERE}?error=${encodeURIComponent(`${WEEKDAYS[d]}: the end time must be after the start time.`)}#hours`);
    }
    rows.push({ weekday: d, startMin, endMin });
  }
  await db.$transaction([
    db.availability.deleteMany({ where: { conciergeId: profile.id } }),
    db.availability.createMany({ data: rows.map((r) => ({ ...r, conciergeId: profile.id })) }),
  ]);
  revalidatePath(HERE);
  redirect(`${HERE}?saved=hours#hours`);
}

async function addTimeOff(f: FormData) {
  "use server";
  const { profile } = await myProfile(HERE);
  const from = String(f.get("from") ?? "");
  const to = String(f.get("to") ?? "") || from;
  if (!isValidDate(from) || !isValidDate(to) || to < from) redirect(`${HERE}?error=${encodeURIComponent("Choose a start date and an end date on or after it.")}#timeoff`);
  await db.timeOff.create({
    data: {
      conciergeId: profile.id,
      start: zonedToInstant(from, 0, brand.timeZone),
      end: zonedToInstant(addDays(to, 1), 0, brand.timeZone),
      note: String(f.get("note") ?? "").trim().slice(0, 140) || null,
    },
  });
  redirect(`${HERE}?saved=timeoff#timeoff`);
}

async function removeTimeOff(f: FormData) {
  "use server";
  const { profile } = await myProfile(HERE);
  await db.timeOff.deleteMany({ where: { id: String(f.get("id")), conciergeId: profile.id } });
  revalidatePath(HERE);
}

export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { profile } = await myProfile(HERE);
  const sp = await searchParams;
  const [hours, timeOff] = await Promise.all([
    db.availability.findMany({ where: { conciergeId: profile.id } }),
    db.timeOff.findMany({ where: { conciergeId: profile.id, end: { gt: new Date() } }, orderBy: { start: "asc" } }),
  ]);
  const hoursByDay = new Map(hours.map((a) => [a.weekday, a]));

  return (
    <>
      {sp.error && <p className="notice error" role="alert">{sp.error}</p>}
      <div className="dash-cols">
        <form action={saveHours} className="panel" id="hours">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>Weekly hours</h2>
            {sp.saved === "hours" && <span className="pill pill-done">Saved</span>}
          </div>
          <p className="muted small">Customers can book any time inside these hours that isn&apos;t already booked or marked as time off. Overnight stays aren&apos;t limited by these hours.</p>
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
          {timeOff.length > 0 ? (
            <ul className="item-list">
              {timeOff.map((t) => {
                const last = localDate(new Date(t.end.getTime() - 1), brand.timeZone);
                const first = localDate(t.start, brand.timeZone);
                return (
                  <li key={t.id}>
                    <span>
                      {dayLabel(t.start)}{last !== first ? ` to ${dayLabel(new Date(t.end.getTime() - 1))}` : ""}
                      {t.note && <span className="muted small"> · {t.note}</span>}
                    </span>
                    <form action={removeTimeOff}><input type="hidden" name="id" value={t.id} /><button className="link-btn" type="submit">Remove</button></form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted small">No time off coming up.</p>
          )}
          <form action={addTimeOff} className="form subpanel">
            <h3>Add time off</h3>
            <div className="row">
              <div className="field"><label htmlFor="to-from">From</label><input id="to-from" name="from" type="date" required /></div>
              <div className="field"><label htmlFor="to-to">To (optional)</label><input id="to-to" name="to" type="date" /></div>
            </div>
            <div className="field"><label htmlFor="to-note">Note (only you see this)</label><input id="to-note" name="note" /></div>
            <div><button className="btn btn-sm" type="submit">Add time off</button></div>
            <p className="hint">Existing bookings aren&apos;t cancelled by time off. Cancel them under Bookings if you need to.</p>
          </form>
        </div>
      </div>
    </>
  );
}
