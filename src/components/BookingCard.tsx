import type { ReactNode } from "react";
import type { BookingKind, BookingStatus } from "@prisma/client";
import { money, bookingWhen } from "@/lib/format";
import { StatusPill } from "./StatusPill";

type Booking = {
  kind: BookingKind;
  start: Date;
  end: Date;
  nights: number | null;
  status: BookingStatus;
  priceCents: number;
  address: string;
  notes: string;
  visitNote: string | null;
  service: { name: string };
};

/**
 * One booking as a card: when, what and the price up top, then the details. Cards replace the old
 * tables so a booking reads well on a phone. Pages pass who it's with and any actions as children.
 */
export function BookingCard({ b, who, whoLabel = "Client", children }: { b: Booking; who?: ReactNode; whoLabel?: string; children?: ReactNode }) {
  return (
    <li className="booking">
      <div className="booking-main">
        <div className="booking-top">
          <p className="booking-when">{bookingWhen(b)}</p>
          <StatusPill status={b.status} />
        </div>
        <p className="small">
          {b.kind === "STAY" ? <><span className="tag">Overnight stay</span> </> : null}
          {b.service.name} · <span className="rate">{money(b.priceCents)}</span>
        </p>
        <dl className="booking-facts small">
          {who && <div><dt>{whoLabel}</dt><dd>{who}</dd></div>}
          <div><dt>Where</dt><dd>{b.address}</dd></div>
          {b.notes && <div><dt>Notes</dt><dd>{b.notes}</dd></div>}
          {b.visitNote && <div><dt>{b.kind === "STAY" ? "Stay" : "Visit"} note</dt><dd>{b.visitNote}</dd></div>}
        </dl>
      </div>
      {children && <div className="booking-actions">{children}</div>}
    </li>
  );
}

export function BookingList({ children }: { children: ReactNode }) {
  return <ul className="booking-list">{children}</ul>;
}
