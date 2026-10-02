import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { BookingError, createBooking, validateBookingRequest } from "@/lib/bookings";
import { whenLabel, money } from "@/lib/format";

export async function POST(req: Request) {
  try {
    const request = validateBookingRequest(await req.json().catch(() => null));
    const b = await createBooking(request);
    return NextResponse.json({
      id: b.id,
      when: whenLabel(b.start, b.end),
      service: b.service.name,
      concierge: b.concierge.displayName,
      estimate: money(b.priceCents),
      email: b.customer.email,
    });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 400 });
    // Serialization failure: another booking for the same concierge committed first.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2034") {
      return NextResponse.json({ error: "Sorry, that time was just taken. Please pick another." }, { status: 409 });
    }
    console.error(e);
    return NextResponse.json({ error: "Something went wrong saving your booking. Please try again." }, { status: 500 });
  }
}
