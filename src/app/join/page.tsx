import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { brand } from "@/lib/brand";
import { sendEmail } from "@/lib/email";
import { readProfileForm, uniqueSlug } from "@/lib/profile-form";
import { ProfileFields } from "@/components/ProfileFields";

export const metadata: Metadata = { title: "Become a concierge" };

const DEFAULT_HOURS = [1, 2, 3, 4, 5].map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 }));

async function apply(formData: FormData) {
  "use server";
  const user = await requireUser(undefined, "/join");
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
        services: { create: v.serviceIds.map((serviceId) => ({ serviceId })) },
        availability: { create: DEFAULT_HOURS },
      },
    }),
    ...(user.role === "CUSTOMER" ? [db.user.update({ where: { id: user.id }, data: { role: "CONCIERGE" } })] : []),
  ]);
  const admins = await db.user.findMany({ where: { role: "ADMIN" }, select: { email: true } });
  for (const a of admins) {
    await sendEmail({ to: a.email, subject: `New concierge to review: ${v.displayName}`, text: `${v.displayName} (${user.email}) applied to join ${brand.name}. Review them in the admin page.` });
  }
  redirect("/concierge?welcome=1");
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const user = await requireUser(undefined, "/join");
  if (user.profile) redirect("/concierge");
  const { error } = await searchParams;
  const services = await db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } });
  return (
    <section className="section">
      <div className="wrap stack" style={{ maxWidth: 760 }}>
        <p className="eyebrow">Become a concierge</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>Set up your profile</h1>
        <p className="muted">
          Your profile goes live once {brand.name} has approved it. You'll start with weekday hours of 9 to 5, which you can change from your schedule page.
        </p>
        <form action={apply} className="form panel">
          <ProfileFields services={services} d={{ displayName: user.name }} />
          {error && <p className="error">{error}</p>}
          <div><button className="btn" type="submit">Submit for approval</button></div>
        </form>
      </div>
    </section>
  );
}
