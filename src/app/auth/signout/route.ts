import { NextResponse } from "next/server";
import { signOut, appUrl } from "@/lib/auth";

export async function POST() {
  await signOut();
  return NextResponse.redirect(new URL("/", appUrl()), { status: 303 });
}
