import { redirect } from "next/navigation";
import { requireUser } from "./auth";

/** The signed-in concierge and their profile. Admins without one are sent to set it up. */
export async function myProfile(from = "/concierge") {
  const user = await requireUser(undefined, from);
  if (!user.profile) redirect(user.role === "ADMIN" ? "/concierge/setup" : "/");
  return { user, profile: user.profile };
}
