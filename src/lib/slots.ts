import { addDays, weekdayOf, zonedToInstant } from "./time";

export type WeeklyHours = { weekday: number; startMin: number; endMin: number };
export type Interval = { start: Date; end: Date };

export type SlotInput = {
  date: string; // "YYYY-MM-DD" in the business time zone
  hours: number;
  weekly: WeeklyHours[];
  busy: Interval[]; // existing bookings and time off
  now: Date;
  timeZone: string;
  minLeadHours: number;
  stepMinutes?: number;
};

function overlaps(a: Interval, b: Interval) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Start times on one day when a concierge is free for the whole booking:
 * inside their weekly hours, clear of bookings and time off, and far enough ahead.
 */
export function openStarts(input: SlotInput): Date[] {
  const step = input.stepMinutes ?? 60;
  const length = input.hours * 60;
  const weekday = weekdayOf(input.date);
  const earliest = input.now.getTime() + input.minLeadHours * 3600_000;
  const out: Date[] = [];
  const seen = new Set<number>();

  for (const block of input.weekly.filter((w) => w.weekday === weekday)) {
    for (let m = block.startMin; m + length <= block.endMin; m += step) {
      const start = zonedToInstant(input.date, m, input.timeZone);
      const end = new Date(start.getTime() + length * 60_000);
      if (start.getTime() < earliest) continue;
      if (input.busy.some((b) => overlaps({ start, end }, b))) continue;
      if (seen.has(start.getTime())) continue;
      seen.add(start.getTime());
      out.push(start);
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** Whether one specific start time is still open. Used to re-check at booking time. */
export function isOpen(input: SlotInput, start: Date): boolean {
  return openStarts(input).some((s) => s.getTime() === start.getTime());
}

/** The calendar dates between two dates, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The local-midnight bounds of a stay that takes up every day from `first` to `last`, inclusive. */
export function stayInterval(first: string, last: string, timeZone: string): Interval {
  return { start: zonedToInstant(first, 0, timeZone), end: zonedToInstant(addDays(last, 1), 0, timeZone) };
}

/** Nights in a stay from `first` (arrival day) to `last` (departure day). */
export function nightsBetween(first: string, last: string): number {
  const [a, b] = [first, last].map((d) => Date.parse(`${d}T00:00:00Z`));
  return Math.round((b! - a!) / 86_400_000);
}

/** Days between two dates that a stay can't touch because something is already booked or marked off. */
export function stayBlockedDates(from: string, to: string, busy: Interval[], timeZone: string): string[] {
  return datesBetween(from, to).filter((d) => busy.some((b) => overlaps(stayInterval(d, d, timeZone), b)));
}

/** Whether a stay from `first` to `last` is clear of bookings and time off on every day. */
export function stayIsOpen(first: string, last: string, busy: Interval[], timeZone: string): boolean {
  const stay = stayInterval(first, last, timeZone);
  return !busy.some((b) => overlaps(stay, b));
}
