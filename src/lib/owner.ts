import { db } from "./db";

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
