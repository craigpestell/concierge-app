import { brand } from "./brand";
import { appUrl } from "./auth";
import { bookingWhen, dayLabel, money, nightsLabel } from "./format";
import { formatPhone } from "./phone";

/**
 * Every email the site sends, client and owner alike. Each template returns a subject plus
 * matching plain-text and HTML bodies built from the same blocks, so the two never drift apart.
 * /admin/emails previews them all with sample data.
 */

export type EmailContent = { subject: string; text: string; html: string };

export type BookingEmailData = {
  kind: "VISIT" | "STAY";
  start: Date;
  end: Date;
  nights: number | null;
  address: string;
  notes: string;
  priceCents: number;
  service: { name: string };
  customer: { name: string; email: string; phone: string | null };
  concierge: { displayName: string; businessPhone: string | null };
};

export type CancelledBy = "customer" | "concierge" | "admin";

type Block = {
  /** Short line some inboxes show after the subject. */
  preview?: string;
  heading: string;
  paragraphs: string[];
  details?: [label: string, value: string][];
  button?: { label: string; url: string };
  /** Small print under the button. */
  after?: string[];
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const multiline = (s: string) => esc(s).replace(/\n/g, "<br>");

// Brand colours from globals.css, inlined because most mail clients drop <style> rules.
const c = { paper: "#f5f6f2", card: "#ffffff", ink: "#15272c", soft: "#4a5b5f", rule: "#d5dad3", brass: "#9b7432", harbour: "#1d3a40" };

export function renderEmail(subject: string, b: Block): EmailContent {
  const text = [
    b.heading,
    "",
    ...b.paragraphs.flatMap((p) => [p, ""]),
    ...(b.details?.length ? [...b.details.map(([k, v]) => `${k}: ${v}`), ""] : []),
    ...(b.button ? [`${b.button.label}: ${b.button.url}`, ""] : []),
    ...(b.after ?? []).flatMap((p) => [p, ""]),
    brand.name,
    `${brand.area} · ${appUrl()}`,
  ].join("\n");

  const font = "font-family:Georgia,'Times New Roman',serif";
  const sans = "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.paper};">
${b.preview ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(b.preview)}</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.paper};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
<tr><td style="padding:0 4px 16px;${font};font-size:20px;color:${c.ink};">
<span style="display:inline-block;width:34px;height:34px;line-height:34px;border:1px solid ${c.brass};border-radius:50%;text-align:center;font-size:14px;color:${c.brass};margin-right:8px;">${esc(brand.monogram)}</span>${esc(brand.name)}
</td></tr>
<tr><td style="background:${c.card};border:1px solid ${c.rule};border-radius:10px;padding:28px 26px;${sans};font-size:16px;line-height:1.55;color:${c.ink};">
<h1 style="margin:0 0 14px;${font};font-weight:normal;font-size:26px;line-height:1.2;color:${c.ink};">${esc(b.heading)}</h1>
${b.paragraphs.map((p) => `<p style="margin:0 0 14px;">${multiline(p)}</p>`).join("\n")}
${
  b.details?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;border-top:1px solid ${c.rule};">${b.details
        .map(([k, v]) => `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid ${c.rule};color:${c.soft};font-size:14px;vertical-align:top;white-space:nowrap;">${esc(k)}</td><td style="padding:9px 0;border-bottom:1px solid ${c.rule};vertical-align:top;">${multiline(v)}</td></tr>`)
        .join("")}</table>`
    : ""
}
${b.button ? `<p style="margin:20px 0 14px;"><a href="${esc(b.button.url)}" style="display:inline-block;background:${c.harbour};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:999px;font-weight:600;">${esc(b.button.label)}</a></p>` : ""}
${(b.after ?? []).map((p) => `<p style="margin:0 0 10px;color:${c.soft};font-size:14px;">${multiline(p)}</p>`).join("\n")}
</td></tr>
<tr><td style="padding:16px 4px;${sans};font-size:13px;color:${c.soft};">${esc(brand.name)} · ${esc(brand.area)} · <a href="${esc(appUrl())}" style="color:${c.brass};">${esc(appUrl().replace(/^https?:\/\//, ""))}</a></td></tr>
</table></td></tr></table>
</body></html>`;

  return { subject, text, html };
}

// Shared pieces --------------------------------------------------------------------------------

const isStay = (b: BookingEmailData) => b.kind === "STAY";
const what = (b: BookingEmailData) => (isStay(b) ? `Overnight stay (${b.service.name.toLowerCase()})` : b.service.name);
const phone = (b: BookingEmailData) => (b.concierge.businessPhone ? formatPhone(b.concierge.businessPhone) : brand.phone);
const first = (name: string) => name.split(" ")[0]!;
const estimate = (b: BookingEmailData) =>
  isStay(b) ? `${money(b.priceCents)} for ${nightsLabel(b.nights ?? 0)}, paid after the stay` : `${money(b.priceCents)}, paid after the visit`;

function bookingDetails(b: BookingEmailData): [string, string][] {
  return [
    ["Service", what(b)],
    ["When", bookingWhen(b)],
    ["Where", b.address],
    ["Estimate", estimate(b)],
    ...(b.notes ? ([["Your notes", b.notes]] as [string, string][]) : []),
  ];
}

const accountButton = () => ({ label: "See or change your booking", url: `${appUrl()}/account` });
const scheduleButton = () => ({ label: "Open your schedule", url: `${appUrl()}/concierge` });

/** True when a cancellation came inside the free-cancellation window. */
export function isLateCancel(b: { start: Date }, at = new Date()) {
  return b.start.getTime() - at.getTime() < brand.cancelFreeHours * 3600_000;
}

// Client emails ----------------------------------------------------------------------------------

export function bookingConfirmed(b: BookingEmailData) {
  const name = b.concierge.displayName;
  return renderEmail(`Booked: ${what(b)} with ${name}`, {
    preview: `${bookingWhen(b)} · ${b.address}`,
    heading: "You're booked",
    paragraphs: [
      `Hi ${first(b.customer.name)}, thank you for booking with ${brand.name}. ${name} has you in the calendar.`,
      isStay(b)
        ? `${first(name)} will be in touch before the stay to arrange arrival times, keys and care notes.`
        : `${first(name)} will arrive at the start time. If anything changes, call or text ${phone(b)}.`,
    ],
    details: bookingDetails(b),
    button: accountButton(),
    after: [`Free cancellation up to ${brand.cancelFreeHours} hours before. Sign in with ${b.customer.email} to see or cancel your booking.`],
  });
}

export function bookingReminder(b: BookingEmailData) {
  const name = first(b.concierge.displayName);
  return renderEmail(`Reminder: ${what(b)} ${isStay(b) ? "starts" : "on"} ${dayLabel(b.start)}`, {
    preview: `${bookingWhen(b)} with ${name}`,
    heading: isStay(b) ? "Your stay is coming up" : "See you soon",
    paragraphs: [
      isStay(b)
        ? `Hi ${first(b.customer.name)}, a reminder that ${name}'s stay at your home starts soon. If you haven't already, please have keys, care notes and any instructions ready.`
        : `Hi ${first(b.customer.name)}, a reminder that ${name} is booked to help you soon.`,
      `Need to change something? Call or text ${phone(b)}.`,
    ],
    details: bookingDetails(b),
    button: accountButton(),
  });
}

export function bookingCancelled(b: BookingEmailData, by: CancelledBy, at = new Date()) {
  const when = bookingWhen(b);
  if (by === "customer") {
    return renderEmail(`Cancelled: ${what(b)}, ${when}`, {
      preview: "Your cancellation is confirmed.",
      heading: "Your booking is cancelled",
      paragraphs: [
        `Hi ${first(b.customer.name)}, this confirms you cancelled your booking. Nothing more is needed from you.`,
        isLateCancel(b, at)
          ? `As it was less than ${brand.cancelFreeHours} hours' notice, a late-cancellation charge may apply. ${first(b.concierge.displayName)} will be in touch if so.`
          : "There's no charge.",
      ],
      details: [["Service", what(b)], ["When", when]],
      button: { label: "Book another time", url: `${appUrl()}/book` },
    });
  }
  return renderEmail(`Your booking for ${when} was cancelled`, {
    preview: "Sorry, we've had to cancel your booking.",
    heading: "We've had to cancel your booking",
    paragraphs: [
      `Hi ${first(b.customer.name)}, we're sorry: your booking with ${b.concierge.displayName} has been cancelled and there's no charge.`,
      `Please book another time, or call ${phone(b)} and we'll find one that works.`,
    ],
    details: [["Service", what(b)], ["When", when]],
    button: { label: "Book another time", url: `${appUrl()}/book` },
  });
}

export function bookingDone(b: BookingEmailData, note: string) {
  const name = b.concierge.displayName;
  return renderEmail(`${name} finished your ${b.service.name.toLowerCase()} ${isStay(b) ? "stay" : "visit"}`, {
    heading: isStay(b) ? "Your stay is complete" : "Your visit is complete",
    paragraphs: [`Hi ${first(b.customer.name)}, ${name} has finished your ${isStay(b) ? "stay" : "visit"}, ${bookingWhen(b)}.`, ...(note ? [`A note from ${first(name)}:\n${note}`] : [])],
    button: { label: "Book again", url: `${appUrl()}/book` },
    after: [`Thanks for booking with ${brand.name}.`],
  });
}

export function signInLink(url: string, minutes: number) {
  return renderEmail(`Your ${brand.name} sign-in link`, {
    heading: "Sign in",
    paragraphs: [`Use this link to sign in to ${brand.name}. It works once and expires in ${minutes} minutes.`],
    button: { label: "Sign in", url },
    after: ["If you didn't ask for this, you can ignore this email."],
  });
}

// Owner notifications ----------------------------------------------------------------------------

export function ownerNewBooking(b: BookingEmailData) {
  return renderEmail(`New ${isStay(b) ? "stay" : "booking"}: ${what(b)}, ${bookingWhen(b)}`, {
    heading: `New ${isStay(b) ? "overnight stay" : "booking"}`,
    paragraphs: [`${b.customer.name} booked ${what(b).toLowerCase()} with ${b.concierge.displayName}.`],
    details: [
      ["When", bookingWhen(b)],
      ["Where", b.address],
      ["Estimate", estimate(b)],
      ["Phone", b.customer.phone ?? "not given"],
      ["Email", b.customer.email],
      ["Notes", b.notes || "none"],
    ],
    button: scheduleButton(),
  });
}

export function ownerCancelled(b: BookingEmailData, by: CancelledBy, at = new Date()) {
  const who = { customer: b.customer.name, concierge: b.concierge.displayName, admin: "An admin" }[by];
  const late = by === "customer" && isLateCancel(b, at);
  return renderEmail(`Cancelled: ${b.service.name}, ${bookingWhen(b)}`, {
    heading: "Booking cancelled",
    paragraphs: [
      `${who} cancelled ${b.customer.name}'s booking. Those ${isStay(b) ? "days are" : "hours are"} open again on the calendar.`,
      ...(late ? [`This was less than ${brand.cancelFreeHours} hours' notice, so a late-cancellation charge may apply.`] : []),
    ],
    details: [["Service", what(b)], ["When", bookingWhen(b)], ["Client", `${b.customer.name}, ${b.customer.email}${b.customer.phone ? `, ${b.customer.phone}` : ""}`]],
    button: scheduleButton(),
  });
}

export function ownerDone(b: BookingEmailData, note: string) {
  return renderEmail(`Done: ${b.service.name}, ${bookingWhen(b)}`, {
    heading: `${isStay(b) ? "Stay" : "Visit"} marked done`,
    paragraphs: [`${b.concierge.displayName} marked ${b.customer.name}'s ${isStay(b) ? "stay" : "visit"} as done.`, ...(note ? [`Note to the client:\n${note}`] : [])],
    details: [["Service", what(b)], ["When", bookingWhen(b)], ["Estimate", estimate(b)]],
    button: scheduleButton(),
  });
}
