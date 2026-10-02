import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { sendEmail } from "./email";
import { brand } from "./brand";

const SESSION_COOKIE = "session";
const SESSION_DAYS = 30;
const LINK_MINUTES = 30;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export function appUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function adminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Only allow redirects to paths on this site. */
export function safeRedirect(path: string | null | undefined) {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/account";
}

/** Finds or creates the user, then emails a one-time sign-in link. */
export async function sendSignInLink(email: string, name: string | null, redirectTo: string) {
  const normalized = normalizeEmail(email);
  const user = await db.user.upsert({
    where: { email: normalized },
    update: {},
    create: { email: normalized, name: name?.trim() || normalized.split("@")[0]! },
  });
  const token = randomBytes(32).toString("base64url");
  await db.loginToken.create({
    data: {
      tokenHash: hash(token),
      userId: user.id,
      redirect: safeRedirect(redirectTo),
      expiresAt: new Date(Date.now() + LINK_MINUTES * 60_000),
    },
  });
  await sendEmail({
    to: normalized,
    subject: `Your ${brand.name} sign-in link`,
    text: `Use this link to sign in to ${brand.name}. It works once and expires in ${LINK_MINUTES} minutes.\n\n${appUrl()}/auth/verify?token=${token}\n\nIf you didn't ask for this, you can ignore this email.`,
  });
}

/** Exchanges a sign-in token for a session. Returns where to send the user, or null if the link is bad. */
export async function consumeSignInToken(token: string) {
  const record = await db.loginToken.findUnique({ where: { tokenHash: hash(token) }, include: { user: true } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return null;
  await db.loginToken.update({ where: { id: record.id }, data: { usedAt: new Date() } });

  if (adminEmails().includes(record.user.email) && record.user.role !== "ADMIN") {
    await db.user.update({ where: { id: record.user.id }, data: { role: "ADMIN" } });
  }

  const sessionToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { tokenHash: hash(sessionToken), userId: record.userId, expiresAt } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
  return safeRedirect(record.redirect);
}

export async function currentUser() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hash(token) },
    include: { user: { include: { profile: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

export async function requireUser(roles?: Role[], from = "/account") {
  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(from)}`);
  if (roles && !roles.includes(user.role)) redirect("/account");
  return user;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: hash(token) } });
  jar.delete(SESSION_COOKIE);
}
