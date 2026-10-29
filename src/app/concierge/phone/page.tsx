import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { brand } from "@/lib/brand";
import { requireUser } from "@/lib/auth";
import { PROVIDERS, formatPhone, normalizePhone, providerGuide, telHref } from "@/lib/phone";

export const metadata: Metadata = { title: "Business phone" };

async function myProfile() {
  const user = await requireUser(undefined, "/concierge/phone");
  if (!user.profile) redirect(user.role === "ADMIN" ? "/concierge/setup" : "/");
  return user.profile;
}

async function savePhone(f: FormData) {
  "use server";
  const profile = await myProfile();
  const provider = String(f.get("provider") ?? "");
  const back = `/concierge/phone${providerGuide(provider) ? `?provider=${provider}` : ""}`;
  const phone = normalizePhone(String(f.get("phone") ?? ""));
  if (!phone) redirect(`${back}${back.includes("?") ? "&" : "?"}error=${encodeURIComponent("Enter the full 10-digit number, for example 778-555-0142.")}#save`);
  await db.conciergeProfile.update({
    where: { id: profile.id },
    data: { businessPhone: phone, phoneProvider: providerGuide(provider) ? provider : "other" },
  });
  revalidatePath("/", "layout");
  redirect("/concierge/phone?saved=1#save");
}

async function clearPhone() {
  "use server";
  const profile = await myProfile();
  await db.conciergeProfile.update({ where: { id: profile.id }, data: { businessPhone: null, phoneProvider: null } });
  revalidatePath("/", "layout");
  redirect("/concierge/phone#save");
}

export default async function PhoneSetupPage({ searchParams }: { searchParams: Promise<{ provider?: string; error?: string; saved?: string }> }) {
  const profile = await myProfile();
  const sp = await searchParams;
  const current = profile.businessPhone ? formatPhone(profile.businessPhone) : null;
  const guide = providerGuide(sp.provider) ?? providerGuide(profile.phoneProvider) ?? PROVIDERS[0]!;

  return (
    <section className="section">
      <div className="wrap dash" style={{ maxWidth: 860 }}>
        <div className="stack" style={{ gap: "0.4rem" }}>
          <Link className="small" href="/concierge#phone">&larr; Back to my schedule</Link>
          <p className="eyebrow">Business phone</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>Get a free business number</h1>
          <p className="muted">
            A separate number for {brand.name} keeps your personal mobile private. Clients call or text the business line, and it rings on your phone.
            Both options below are free in Canada. Pick one, follow the steps, then save the number at the bottom so the website shows it.
          </p>
        </div>

        {current ? (
          <p className="notice">The website shows <strong>{current}</strong>. Save a new number below to change it.</p>
        ) : (
          <p className="notice">The website still shows the placeholder number {brand.phone}. Set up a line below and save it to replace it.</p>
        )}

        <div className="stack" style={{ gap: "0.8rem" }}>
          <h2 style={{ fontSize: "var(--step-2)" }}>1. Choose a service</h2>
          <div className="cards">
            {PROVIDERS.map((p, i) => (
              <Link key={p.id} className="card" href={`/concierge/phone?provider=${p.id}`} aria-current={p.id === guide.id ? "true" : undefined} style={p.id === guide.id ? { borderColor: "var(--brass)" } : undefined}>
                <div className="panel-head">
                  <h3>{p.name}</h3>
                  {i === 0 && <span className="pill pill-confirmed">Recommended</span>}
                </div>
                <p className="muted small">{p.summary}</p>
                <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
                  {p.goodFor.map((g) => <li key={g}>{g}</li>)}
                </ul>
                <span className="chip" aria-pressed={p.id === guide.id}>{p.id === guide.id ? "Selected" : `Use ${p.name}`}</span>
              </Link>
            ))}
          </div>
        </div>

        <div className="panel" id="steps">
          <h2 style={{ fontSize: "var(--step-2)" }}>2. Set up {guide.name}</h2>
          <ol className="stack" style={{ margin: 0, paddingLeft: "1.3rem", gap: "1.1rem" }}>
            {guide.steps.map((s) => (
              <li key={s.title}>
                <strong>{s.title}</strong>
                <p className="muted" style={{ margin: "0.3rem 0 0" }}>{s.body}</p>
                {s.link && (
                  <p style={{ margin: "0.4rem 0 0" }}>
                    <a className="btn btn-ghost btn-sm" href={s.link.href} target="_blank" rel="noopener noreferrer">{s.link.label}</a>
                  </p>
                )}
              </li>
            ))}
          </ol>
          <div className="stack" style={{ gap: "0.4rem" }}>
            <h3>Good to know</h3>
            <ul className="small" style={{ margin: 0, paddingLeft: "1.1rem" }}>
              {guide.watchOut.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
          <p className="notice small"><strong>Keep the number:</strong> {guide.keepAlive}</p>
          <p className="hint">
            Steps checked against {guide.name}&apos;s own pages in October 2026. If a screen looks different, their help pages have the latest:{" "}
            {guide.sources.map((s, i) => (
              <span key={s.href}>{i > 0 && ", "}<a href={s.href} target="_blank" rel="noopener noreferrer">{s.label}</a></span>
            ))}
            .
          </p>
        </div>

        <form action={savePhone} className="panel form" id="save">
          <div className="panel-head">
            <h2 style={{ fontSize: "var(--step-2)" }}>3. Show it on the website</h2>
            {sp.saved && <span className="pill pill-done">Saved</span>}
          </div>
          <p className="muted small">
            Once a test call works, enter the new number here. It replaces the phone number on the home page, the booking page and cancellation emails.
          </p>
          <input type="hidden" name="provider" value={guide.id} />
          <div className="row">
            <div className="field">
              <label htmlFor="phone">Business phone number</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="off" placeholder="778-555-0142" defaultValue={current ?? ""} required />
            </div>
          </div>
          {sp.error && <p className="error" role="alert">{sp.error}</p>}
          <div className="inline-form">
            <button className="btn btn-sm" type="submit">Save number</button>
            {current && <a className="small" href={telHref(current)}>Call it to test</a>}
          </div>
        </form>
        {current && (
          <form action={clearPhone}>
            <button className="link-btn" type="submit">Stop showing a business number (go back to the placeholder)</button>
          </form>
        )}
      </div>
    </section>
  );
}
