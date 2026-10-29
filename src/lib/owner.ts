import { db } from "./db";
import { brand } from "./brand";
import { formatPhone } from "./phone";

/**
 * The site promotes one person: the business owner. Her profile is the first approved, visible
 * concierge profile, and every booking goes to her calendar.
 */
export function getOwner() {
  return db.conciergeProfile.findFirst({
    where: { approved: true, visible: true },
    include: { services: { include: { service: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export function firstName(displayName: string) {
  return displayName.split(" ")[0]!;
}

/** Her profile whether or not it's currently taking bookings, for the admin page. */
export function getOwnerProfile() {
  return db.conciergeProfile.findFirst({ orderBy: { createdAt: "asc" } });
}

/** The number the public site shows: her saved business line, or the placeholder until she sets one. */
export async function publicPhone() {
  const p = await db.conciergeProfile.findFirst({ where: { businessPhone: { not: null } }, orderBy: { createdAt: "asc" }, select: { businessPhone: true } });
  return p?.businessPhone ? formatPhone(p.businessPhone) : brand.phone;
}
