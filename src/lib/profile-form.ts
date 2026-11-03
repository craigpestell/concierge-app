import { slugify } from "./format";
import { db } from "./db";

export const AREAS = ["New Westminster", "Burnaby"];

export type ProfileInput = {
  displayName: string;
  headline: string;
  bio: string;
  photoUrl: string | null;
  hourlyRateCents: number;
  /** Undefined leaves the saved rate alone (the stays flag is off); null means no stays. */
  nightlyRateCents?: number | null;
  areas: string[];
  serviceIds: string[];
};

/** Raw profile fields from the web form or the MCP server, before checking. Rates are in dollars. */
export type RawProfile = {
  displayName: string;
  headline: string;
  bio: string;
  photoUrl: string;
  rate: number;
  /** Null or "" means no stays; undefined leaves the saved rate alone. */
  nightlyRate?: number | string | null;
  areas: string[];
  serviceIds: string[];
};

/** Checks the shared profile fields. Returns an error message or the values to save. */
export function validateProfile(raw: RawProfile, stays = false): { error: string } | { value: ProfileInput } {
  const displayName = raw.displayName.trim().slice(0, 80);
  const headline = raw.headline.trim().slice(0, 140);
  const bio = raw.bio.trim().slice(0, 2000);
  const photo = raw.photoUrl.trim();
  const rate = raw.rate;
  const areas = raw.areas.filter((a) => AREAS.includes(a));
  const serviceIds = raw.serviceIds;
  if (!displayName) return { error: "Add the name customers will see." };
  if (!Number.isFinite(rate) || rate < 20 || rate > 200) return { error: "Set an hourly rate between $20 and $200." };
  if (!areas.length) return { error: "Choose at least one area." };
  if (!serviceIds.length) return { error: "Choose at least one service." };
  let nightlyRateCents: number | null | undefined;
  if (stays && raw.nightlyRate !== undefined) {
    const text = raw.nightlyRate === null ? "" : String(raw.nightlyRate).trim();
    const nightly = Number(text);
    if (text && (!Number.isFinite(nightly) || nightly < 20 || nightly > 1000)) return { error: "Set a nightly rate between $20 and $1000, or leave it empty if you don't take stays." };
    nightlyRateCents = text ? Math.round(nightly * 100) : null;
  }
  if (photo && !/^https:\/\/\S+$/.test(photo)) return { error: "The photo link must start with https://" };
  return { value: { displayName, headline, bio, photoUrl: photo || null, hourlyRateCents: Math.round(rate * 100), nightlyRateCents, areas, serviceIds } };
}

/** Reads and checks the shared profile fields from a form. Returns an error message or the values. */
export function readProfileForm(f: FormData, stays = false): { error: string } | { value: ProfileInput } {
  return validateProfile(
    {
      displayName: String(f.get("displayName") ?? ""),
      headline: String(f.get("headline") ?? ""),
      bio: String(f.get("bio") ?? ""),
      photoUrl: String(f.get("photoUrl") ?? ""),
      rate: Number(f.get("rate")),
      nightlyRate: String(f.get("nightlyRate") ?? ""),
      areas: f.getAll("areas").map(String),
      serviceIds: f.getAll("services").map(String),
    },
    stays,
  );
}

export async function uniqueSlug(name: string, excludeId?: string) {
  const base = slugify(name) || "concierge";
  for (let i = 1; ; i++) {
    const slug = i === 1 ? base : `${base}-${i}`;
    const taken = await db.conciergeProfile.findFirst({ where: { slug, NOT: excludeId ? { id: excludeId } : undefined } });
    if (!taken) return slug;
  }
}
