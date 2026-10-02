import { brand } from "./brand";

export function money(cents: number) {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: brand.timeZone, weekday: "long", month: "long", day: "numeric" });
const timeFmt = new Intl.DateTimeFormat("en-CA", { timeZone: brand.timeZone, hour: "numeric", minute: "2-digit" });

export function dayLabel(d: Date) {
  return dayFmt.format(d);
}

export function timeLabel(d: Date) {
  return timeFmt.format(d).replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`);
}

export function whenLabel(start: Date, end: Date) {
  return `${dayLabel(start)}, ${timeLabel(start)} – ${timeLabel(end)}`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}
