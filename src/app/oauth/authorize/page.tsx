import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { hostOf, MCP_ROLES, readAuthorizeRequest } from "@/lib/oauth";

export const metadata: Metadata = { title: "Connect an AI app", robots: { index: false, follow: false } };

// Step 2 of connecting an AI app: she signs in (if needed) and approves or declines the app.
// The decision is posted to /oauth/authorize/decide, which sends her back to the app.
export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) if (typeof v === "string") q.set(k, v);
  const here = `/oauth/authorize?${q.toString()}`;

  const user = await currentUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(here)}`);

  const read = await readAuthorizeRequest(q);
  if (!read.ok && "redirect" in read) redirect(read.redirect);

  return (
    <section className="section">
      <div className="wrap stack" style={{ maxWidth: 620 }}>
        <p className="eyebrow">Connect an AI app</p>
        {!read.ok ? (
          <>
            <h1 style={{ fontSize: "var(--step-3)" }}>This connection can&apos;t go ahead</h1>
            <p className="notice error" role="alert">{read.show}</p>
          </>
        ) : !MCP_ROLES.includes(user.role) ? (
          <>
            <h1 style={{ fontSize: "var(--step-3)" }}>Only the site owner can connect apps</h1>
            <p className="muted">You&apos;re signed in as {user.email}, which is a client account. If you run {brand.name}, sign out and sign in with your owner email.</p>
            <form method="post" action="/auth/signout"><button className="btn btn-ghost btn-sm" type="submit">Sign out</button></form>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: "var(--step-3)" }}>Let “{read.clientName}” manage your site?</h1>
            <div className="panel">
              <p style={{ margin: 0 }}>
                The app will send you back to <strong>{hostOf(read.req.redirectUri)}</strong>. Only continue if you just started connecting from that app yourself.
              </p>
              <p className="muted small" style={{ margin: 0 }}>Signed in as {user.email}. Apps name themselves, so check the address above rather than the name.</p>
              <div className="stack" style={{ gap: "0.4rem" }}>
                <strong>It will be able to</strong>
                <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  <li>See and change your profile, rates, services and service areas</li>
                  <li>See and change your weekly hours, time off and business phone number</li>
                  <li>See your bookings with client contact details, cancel them and mark them done (which emails the client)</li>
                </ul>
                <strong>It won&apos;t be able to</strong>
                <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  <li>Change the website&apos;s code or design, or publish anything else</li>
                  <li>Make bookings, take payments or see your sign-in email links</li>
                </ul>
              </div>
              <form method="post" action="/oauth/authorize/decide" className="inline-form">
                <input type="hidden" name="query" value={q.toString()} />
                <button className="btn" type="submit" name="decision" value="approve">Allow</button>
                <button className="btn btn-ghost" type="submit" name="decision" value="deny">Decline</button>
              </form>
              <p className="hint">You can disconnect it any time under My schedule, AI assistant.</p>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
