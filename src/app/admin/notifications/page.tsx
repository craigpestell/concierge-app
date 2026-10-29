import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { sendEmail } from "@/lib/email";
import { cleanEvents, normalizeEmail, notifyEvents } from "@/lib/notify";

export const metadata: Metadata = { title: "Notifications" };

const path = "/admin/notifications";
const admin = () => requireUser(["ADMIN"], path);

async function addRecipient(f: FormData) {
  "use server";
  await admin();
  const email = normalizeEmail(String(f.get("email") ?? ""));
  if (!email) redirect(`${path}?error=email`);
  const events = cleanEvents(f.getAll("events").map(String));
  await db.notificationRecipient.upsert({ where: { email }, update: { events }, create: { email, events } });
  revalidatePath(path);
}

async function updateRecipient(f: FormData) {
  "use server";
  await admin();
  await db.notificationRecipient.update({ where: { id: String(f.get("id")) }, data: { events: cleanEvents(f.getAll("events").map(String)) } });
  redirect(`${path}?saved=1`);
}

async function removeRecipient(f: FormData) {
  "use server";
  await admin();
  await db.notificationRecipient.deleteMany({ where: { id: String(f.get("id")) } });
  revalidatePath(path);
}

async function sendTest(f: FormData) {
  "use server";
  await admin();
  const r = await db.notificationRecipient.findUnique({ where: { id: String(f.get("id")) } });
  if (!r) return;
  await sendEmail({
    to: r.email,
    subject: `Test notification from ${brand.name}`,
    text: `This is a test. ${r.email} is on the notification list at ${process.env.APP_URL ?? ""}${path}.\n\nIt gets: ${notifyEvents.filter((e) => r.events.includes(e.key)).map((e) => e.label.toLowerCase()).join(", ") || "nothing yet"}.`,
  });
  redirect(`${path}?tested=${encodeURIComponent(r.email)}`);
}

function EventChecks({ idPrefix, checked }: { idPrefix: string; checked: (key: string) => boolean }) {
  return (
    <div className="chips">
      {notifyEvents.map((e) => (
        <label key={e.key} className="check check-chip" htmlFor={`${idPrefix}-${e.key}`}>
          <input id={`${idPrefix}-${e.key}`} type="checkbox" name="events" value={e.key} defaultChecked={checked(e.key)} />
          {e.label}
        </label>
      ))}
    </div>
  );
}

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; tested?: string }> }) {
  await admin();
  const sp = await searchParams;
  const recipients = await db.notificationRecipient.findMany({ orderBy: { createdAt: "asc" } });
  const sending = Boolean(process.env.RESEND_API_KEY);

  return (
    <div className="panel narrow">
      <div className="stack" style={{ gap: "0.4rem" }}>
        <h2 style={{ fontSize: "var(--step-2)" }}>Notifications</h2>
        <p className="muted small">
          Who hears about bookings, stays and cancellations, and who gets mail sent to info@. Clients always get their own confirmation emails.
          {recipients.length === 0 && " With nobody listed, booking emails go to the concierge's account email."}
        </p>
      </div>
      {!sending && (
        <p className="notice">Emails aren&apos;t being delivered yet: the server has no Resend key (RESEND_API_KEY), so they only go to the server log.</p>
      )}
      {sp.error === "email" && <p className="notice error" role="alert">Enter a valid email address.</p>}
      {sp.saved && <p className="notice" role="status">Saved.</p>}
      {sp.tested && <p className="notice" role="status">Test email sent to {sp.tested}.</p>}
      <ul className="item-list">
        {recipients.map((r) => (
          <li key={r.id} style={{ display: "block" }}>
            <form action={updateRecipient} className="stack" style={{ gap: "0.6rem" }}>
              <input type="hidden" name="id" value={r.id} />
              <strong style={{ overflowWrap: "anywhere" }}>{r.email}</strong>
              <EventChecks idPrefix={r.id} checked={(k) => r.events.includes(k)} />
              <div className="add-row">
                <button className="btn btn-sm" type="submit">Save</button>
                <button className="link-btn" type="submit" formAction={sendTest}>Send a test</button>
                <button className="link-btn" type="submit" formAction={removeRecipient}>Remove</button>
              </div>
            </form>
          </li>
        ))}
      </ul>
      <form action={addRecipient} className="stack" style={{ gap: "0.6rem" }}>
        <div className="field">
          <label htmlFor="notify-email">Add someone</label>
          <input id="notify-email" name="email" type="email" autoComplete="off" placeholder="name@example.com" required />
        </div>
        <EventChecks idPrefix="new" checked={() => true} />
        <div>
          <button className="btn btn-sm" type="submit">Add</button>
        </div>
      </form>
      <p className="muted small">New info@ addresses also need verifying once in Cloudflare (Email Routing &gt; Destination addresses) before forwarded mail reaches them.</p>
    </div>
  );
}
