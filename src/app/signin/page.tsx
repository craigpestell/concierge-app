import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sendSignInLink, safeRedirect, currentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

async function requestLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim();
  const next = safeRedirect(String(formData.get("next") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) redirect(`/signin?error=email&next=${encodeURIComponent(next)}`);
  await sendSignInLink(email, null, next);
  redirect(`/signin?sent=1&next=${encodeURIComponent(next)}`);
}

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string; sent?: string; error?: string }> }) {
  const sp = await searchParams;
  const next = safeRedirect(sp.next);
  if (await currentUser()) redirect(next);
  return (
    <section className="section">
      <div className="wrap stack" style={{ maxWidth: 520 }}>
        <p className="eyebrow">Sign in</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>We'll email you a sign-in link</h1>
        {sp.sent ? (
          <p className="notice">Check your email for a sign-in link. It works once and expires in 30 minutes.</p>
        ) : (
          <form action={requestLink} className="form">
            <input type="hidden" name="next" value={next} />
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" autoComplete="email" required />
            </div>
            {sp.error === "email" && <p className="error small">Enter a valid email address.</p>}
            {sp.error === "link" && <p className="error small">That sign-in link has expired or was already used. Request a new one.</p>}
            <div><button className="btn" type="submit">Email me a link</button></div>
            <p className="hint">No password needed. Use the same email you booked with to see your bookings.</p>
          </form>
        )}
      </div>
    </section>
  );
}
