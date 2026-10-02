// Time helpers for a single business time zone, without a date library.
// Dates on the calendar are plain "YYYY-MM-DD" strings in that zone; instants are Date objects.

const partsCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string) {
  let f = partsCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsCache.set(timeZone, f);
  }
  return f;
}

/** Wall-clock fields of an instant in the given zone. */
export function wallTime(instant: Date, timeZone: string) {
  const p: Record<string, number> = {};
  for (const part of partsFormatter(timeZone).formatToParts(instant)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return { year: p.year, month: p.month, day: p.day, hour: p.hour, minute: p.minute, second: p.second };
}

/** Offset of the zone from UTC at an instant, in milliseconds (negative west of UTC). */
export function zoneOffsetMs(instant: Date, timeZone: string) {
  const w = wallTime(instant, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** The instant at which the zone's wall clock reads `date` plus `minutes` after midnight. */
export function zonedToInstant(date: string, minutes: number, timeZone: string): Date {
  const [y, m, d] = parseDate(date);
  const naive = Date.UTC(y, m - 1, d, 0, minutes);
  let guess = naive - zoneOffsetMs(new Date(naive), timeZone);
  // Re-check once around daylight-saving changes.
  const corrected = naive - zoneOffsetMs(new Date(guess), timeZone);
  if (corrected !== guess) guess = corrected;
  return new Date(guess);
}

/** The calendar date ("YYYY-MM-DD") of an instant in the zone. */
export function localDate(instant: Date, timeZone: string): string {
  const w = wallTime(instant, timeZone);
  return formatDate(w.year, w.month, w.day);
}

export function parseDate(date: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Invalid date: ${date}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

export function isValidDate(date: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
}

export function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Day of week (0 = Sunday) of a calendar date. */
export function weekdayOf(date: string): number {
  const [y, m, d] = parseDate(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function addDays(date: string, days: number): string {
  const [y, m, d] = parseDate(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return formatDate(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function minutesLabel(min: number): string {
  const h = Math.floor(min / 60);
  const mm = min % 60;
  const ap = h < 12 ? "am" : "pm";
  const hh = h % 12 || 12;
  return mm ? `${hh}:${String(mm).padStart(2, "0")} ${ap}` : `${hh} ${ap}`;
}
