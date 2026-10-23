import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { readProfileForm, uniqueSlug } from "@/lib/profile-form";
import { ProfileFields } from "@/components/ProfileFields";

export const metadata: Metadata = { title: "Set up your profile" };

const DEFAULT_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));

async function apply(formData: FormData) {
  "use server";
  const user = await requireUser(["ADMIN"], "/join");
  if (user.profile) redirect("/concierge");
  const read = readProfileForm(formData);
  if ("error" in read) redirect(`/join?error=${encodeURIComponent(read.error)}`);
  const v = read.value;
  const slug = await uniqueSlug(v.displayName);
  await db.$transaction([
    db.conciergeProfile.create({
      data: {
        userId: user.id,
        slug,
        displayName: v.displayName,
        headline: v.headline,
        bio: v.bio,
        photoUrl: v.photoUrl,
        hourlyRateCents: v.hourlyRateCents,
        areas: v.areas,
        approved: true,
        services: { create: v.serviceIds.map((serviceId) => ({ serviceId })) },
        availability: { create: DEFAULT_HOURS },
      },
    }),
  ]);
  redirect("/concierge");
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser(["ADMIN"], "/join");
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
        <form action={apply} className="form panel">
          <ProfileFields services={services} d={{ displayName: user.name }} />
          {error && <p className="error">{error}</p>}
          <div><button className="btn" type="submit">Publish my profile</button></div>
        </form>
      </div>
    </section>
  );
}
