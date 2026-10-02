import { brand } from "./brand";

type Email = { to: string; subject: string; text: string };

/** Sends through Resend when RESEND_API_KEY is set; otherwise prints to the server log. */
export async function sendEmail(email: Email) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`\n--- email to ${email.to} ---\nSubject: ${email.subject}\n\n${email.text}\n---\n`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM ?? `${brand.name} <${brand.email}>`,
      to: [email.to],
      subject: email.subject,
      text: email.text,
    }),
  });
  if (!res.ok) console.error(`Email to ${email.to} failed: ${res.status} ${await res.text()}`);
}
