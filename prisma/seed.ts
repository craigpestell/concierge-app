import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const SERVICES = [
  ["errands-shopping", "Errands & shopping"],
  ["rides", "Rides & transportation"],
  ["pets-plants", "Pets & plants"],
  ["home-checks", "Home checks & waiting"],
  ["moves-organizing", "Moves & organizing"],
  ["finding-sourcing", "Finding & sourcing"],
  ["visit-for-a-parent", "Visits for a parent"],
] as const;

async function main() {
  for (const [i, [slug, name]] of SERVICES.entries()) {
    await db.service.upsert({ where: { slug }, update: {}, create: { slug, name, sort: i } });
  }
  console.log(`Seeded ${SERVICES.length} services.`);

  // Sample concierges for local development only: SEED_DEMO=1 npm run db:seed
  if (process.env.SEED_DEMO !== "1") return;
  const services = await db.service.findMany();
  const ids = (slugs: string[]) => services.filter((s) => slugs.includes(s.slug)).map((s) => ({ serviceId: s.id }));
  const samples = [
    { email: "sample.one@example.com", name: "Sample Concierge One", slug: "sample-one", headline: "Errands, rides and visits for parents", areas: ["New Westminster"], svc: ["errands-shopping", "rides", "visit-for-a-parent"], days: [1, 2, 3, 4, 5] },
    { email: "sample.two@example.com", name: "Sample Concierge Two", slug: "sample-two", headline: "Pet visits and home checks while you travel", areas: ["New Westminster", "Burnaby"], svc: ["pets-plants", "home-checks"], days: [1, 3, 5, 6] },
    { email: "sample.three@example.com", name: "Sample Concierge Three", slug: "sample-three", headline: "Moves, organizing and finding the right thing", areas: ["Burnaby"], svc: ["moves-organizing", "finding-sourcing", "errands-shopping"], days: [2, 4, 6] },
  ];
  for (const s of samples) {
    const user = await db.user.upsert({ where: { email: s.email }, update: {}, create: { email: s.email, name: s.name, role: "CONCIERGE" } });
    const existing = await db.conciergeProfile.findUnique({ where: { userId: user.id } });
    if (existing) continue;
    await db.conciergeProfile.create({
      data: {
        userId: user.id,
        slug: s.slug,
        displayName: s.name,
        headline: s.headline,
        bio: "This is sample profile text for local development.",
        areas: s.areas,
        approved: true,
        services: { create: ids(s.svc) },
        availability: { create: s.days.map((weekday) => ({ weekday, startMin: 9 * 60, endMin: 17 * 60 })) },
      },
    });
  }
  console.log(`Seeded ${samples.length} sample concierges.`);
}

main().finally(() => db.$disconnect());
