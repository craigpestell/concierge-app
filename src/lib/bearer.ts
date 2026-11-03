import { timingSafeEqual } from "node:crypto";

/** Whether an Authorization header carries `Bearer <secret>`. False when the secret isn't set. */
export function bearerMatches(header: string | null, secret: string | undefined) {
  if (!secret || !header?.startsWith("Bearer ")) return false;
  const given = Buffer.from(header.slice(7));
  const want = Buffer.from(secret);
  return given.length === want.length && timingSafeEqual(given, want);
}
