import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { readProfileForm, uniqueSlug } from "@/lib/profile-form";
import { features } from "@/lib/features";
import { myProfile } from "@/lib/my-profile";
import { ProfileFields } from "@/components/ProfileFields";

export const metadata: Metadata = { title: "Profile & rates" };

const HERE = "/concierge/profile";

async function saveProfile(f: FormData) {
  "use server";
  const { profile } = await myProfile(HERE);
  const read = readProfileForm(f, features.stays());
  if ("error" in read) redirect(`${HERE}?error=${encodeURIComponent(read.error)}`);
  const v = read.value;
  const slug = v.displayName === profile.displayName ? profile.slug : await uniqueSlug(v.displayName, profile.id);
  await db.$transaction([
    db.conciergeService.deleteMany({ where: { conciergeId: profile.id } }),
    db.conciergeProfile.update({
      where: { id: profile.id },
      data: {
        slug,
        displayName: v.displayName,
        headline: v.headline,
        bio: v.bio,
        photoUrl: v.photoUrl,
        hourlyRateCents: v.hourlyRateCents,
        nightlyRateCents: v.nightlyRateCents,
        areas: v.areas,
        visible: f.get("visible") === "on",
        services: { create: v.serviceIds.map((serviceId) => ({ serviceId })) },
      },
    }),
  ]);
  revalidatePath("/", "layout");
  redirect(`${HERE}?saved=1`);
}

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string }> }) {
  const { profile } = await myProfile(HERE);
  const sp = await searchParams;
  const [full, services] = await Promise.all([
    db.conciergeProfile.findUniqueOrThrow({ where: { id: profile.id }, include: { services: true } }),
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
  ]);

  return (
    <form action={saveProfile} className="panel form" id="profile">
      <div className="panel-head">
        <h2 style={{ fontSize: "var(--step-2)" }}>Profile & rates</h2>
        {sp.saved && <span className="pill pill-done">Saved</span>}
      </div>
      <p className="muted small">This is what clients see on your booking page.</p>
      {sp.error && <p className="notice error" role="alert">{sp.error}</p>}
      <ProfileFields
        services={services}
        d={{ ...full, serviceIds: full.services.map((s) => s.serviceId) }}
        stays={features.stays()}
      />
      <fieldset className="form-section" id="visibility">
        <legend>Bookings</legend>
        <label className="check"><input type="checkbox" name="visible" defaultChecked={full.visible} /> Show my profile and take bookings</label>
        <span className="hint">Turn this off to pause new bookings. Existing bookings stay as they are.</span>
      </fieldset>
      <div className="form-foot"><button className="btn" type="submit">Save profile</button></div>
    </form>
  );
}
