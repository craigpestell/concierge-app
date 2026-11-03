import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { readProfileForm } from "@/lib/profile-form";
import { createProfile } from "@/lib/site-edits";
import { features } from "@/lib/features";
import { ProfileFields } from "@/components/ProfileFields";

export const metadata: Metadata = { title: "Set up your profile", robots: { index: false, follow: false } };

async function setUp(formData: FormData) {
  "use server";
  const user = await requireUser(["ADMIN"], "/concierge/setup");
  if (user.profile) redirect("/concierge");
  const read = readProfileForm(formData, features.stays());
  if ("error" in read) redirect(`/concierge/setup?error=${encodeURIComponent(read.error)}`);
  await createProfile(user.id, read.value);
  redirect("/concierge");
}

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser(["ADMIN"], "/concierge/setup");
  if (user.profile) redirect("/concierge");
  const { error } = await searchParams;
  const services = await db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  return (
    <section className="section">
      <div className="wrap stack" style={{ maxWidth: 760 }}>
        <p className="eyebrow">Your booking page</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>Set up your profile</h1>
        <p className="muted">
          This is what clients see when they book you on {brand.name}. You'll start with weekday hours of 9 to 5, which you can change from your schedule page.
        </p>
        <form action={setUp} className="form panel">
          <ProfileFields services={services} d={{ displayName: user.name }} stays={features.stays()} />
          {error && <p className="error">{error}</p>}
          <div><button className="btn" type="submit">Publish my profile</button></div>
        </form>
      </div>
    </section>
  );
}
