import type { BookingStatus } from "@prisma/client";

const labels: Record<BookingStatus, string> = { CONFIRMED: "Confirmed", DONE: "Done", CANCELLED: "Cancelled" };

export function StatusPill({ status }: { status: BookingStatus }) {
  return <span className={`pill pill-${status.toLowerCase()}`}>{labels[status]}</span>;
}
