import { slugify } from "./format";
import { db } from "./db";

export const AREAS = ["New Westminster", "Burnaby"];

export type ProfileInput = {
  displayName: string;
  headline: string;
  bio: string;
  photoUrl: string | null;
  hourlyRateCents: number;
  areas: string[];
  serviceIds: string[];
};

/** Reads and checks the shared profile fields from a form. Returns an error message or the values. */
export function readProfileForm(f: FormData): { error: string } | { value: ProfileInput } {
  const displayName = String(f.get("displayName") ?? "").trim().slice(0, 80);
  const headline = String(f.get("headline") ?? "").trim().slice(0, 140);
  const bio = String(f.get("bio") ?? "").trim().slice(0, 2000);
  const photo = String(f.get("photoUrl") ?? "").trim();
  const rate = Number(f.get("rate"));
  const areas = f.getAll("areas").map(String).filter((a) => AREAS.includes(a));
  const serviceIds = f.getAll("services").map(String);
  if (!displayName) return { error: "Add the name customers will see." };
  if (!Number.isFinite(rate) || rate < 20 || rate > 200) return { error: "Set an hourly rate between $20 and $200." };
  if (!areas.length) return { error: "Choose at least one area." };
  if (!serviceIds.length) return { error: "Choose at least one service." };
  if (photo && !/^https:\/\/\S+$/.test(photo)) return { error: "The photo link must start with https://" };
  return { value: { displayName, headline, bio, photoUrl: photo || null, hourlyRateCents: Math.round(rate * 100), areas, serviceIds } };
}

export async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "concierge";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = await db.conciergeProfile.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
    if (!taken) return slug;
  }
}
