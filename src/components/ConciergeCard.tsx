import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { money } from "@/lib/format";
import { Avatar } from "./Avatar";

export const conciergeCardInclude = { services: { include: { service: true } } } satisfies Prisma.ConciergeProfileInclude;
type CardConcierge = Prisma.ConciergeProfileGetPayload<{ include: typeof conciergeCardInclude }>;

export function ConciergeCard({ c }: { c: CardConcierge }) {
  return (
    <Link className="card" href={`/concierges/${c.slug}`}>
      <div className="card-top">
        <Avatar name={c.displayName} photoUrl={c.photoUrl} />
        <div>
          <h3>{c.displayName}</h3>
          <p className="muted small">{c.areas.join(" · ")}</p>
        </div>
      </div>
      {c.headline && <p>{c.headline}</p>}
      <div className="tags">
        {c.services.filter((s) => s.service.active).map((s) => <span className="tag" key={s.serviceId}>{s.service.name}</span>)}
      </div>
      <p className="rate">{money(c.hourlyRateCents)}/hour</p>
    </Link>
  );
}
