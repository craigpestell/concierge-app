import Link from "next/link";
import type { Metadata } from "next";
import { db } from "@/lib/db";
import { ConciergeCard, conciergeCardInclude } from "@/components/ConciergeCard";

export const metadata: Metadata = { title: "Concierges" };
export const dynamic = "force-dynamic";

export default async function ConciergesPage({ searchParams }: { searchParams: Promise<{ service?: string; area?: string }> }) {
  const { service, area } = await searchParams;
  const [services, all] = await Promise.all([
    db.service.findMany({ where: { active: true }, orderBy: { sort: "asc" } }),
    db.conciergeProfile.findMany({ where: { approved: true, visible: true }, include: conciergeCardInclude, orderBy: { createdAt: "asc" } }),
  ]);
  const areas = [...new Set(all.flatMap((c) => c.areas))].sort();
  const shown = all.filter(
    (c) => (!service || c.services.some((s) => s.service.slug === service)) && (!area || c.areas.includes(area)),
  );
  const href = (p: { service?: string; area?: string }) => {
    const q = new URLSearchParams();
    if (p.service) q.set("service", p.service);
    if (p.area) q.set("area", p.area);
    const s = q.toString();
    return s ? `/concierges?${s}` : "/concierges";
  };

  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head">
          <p className="eyebrow">Book a concierge</p>
          <h1 style={{ fontSize: "var(--step-3)" }}>Find the right person for the job</h1>
          <p>Filter by what you need and where you are, then open a profile to see their calendar.</p>
        </div>
        <nav className="filters" aria-label="Filter by service">
          <Link className="chip" aria-current={!service ? "true" : undefined} href={href({ area })}>All services</Link>
          {services.map((s) => (
            <Link key={s.id} className="chip" aria-current={service === s.slug ? "true" : undefined} href={href({ service: s.slug, area })}>{s.name}</Link>
          ))}
        </nav>
        {areas.length > 1 && (
          <nav className="filters" aria-label="Filter by area">
            <Link className="chip" aria-current={!area ? "true" : undefined} href={href({ service })}>All areas</Link>
            {areas.map((a) => (
              <Link key={a} className="chip" aria-current={area === a ? "true" : undefined} href={href({ service, area: a })}>{a}</Link>
            ))}
          </nav>
        )}
        {shown.length ? (
          <div className="cards">{shown.map((c) => <ConciergeCard key={c.id} c={c} />)}</div>
        ) : (
          <p className="empty">No concierges match those filters yet. Try another service or area.</p>
        )}
      </div>
    </section>
  );
}
