import { NextResponse } from "next/server";
import { consumeSignInToken, appUrl } from "@/lib/auth";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const next = token ? await consumeSignInToken(token) : null;
  return NextResponse.redirect(new URL(next ?? "/signin?error=link", appUrl()));
}
