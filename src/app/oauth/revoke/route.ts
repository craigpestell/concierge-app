import { NextResponse } from "next/server";
import { corsHeaders, OAuthFailure, revoke } from "@/lib/oauth";

export async function POST(req: Request) {
  try {
    await revoke(new URLSearchParams(await req.text()), req.headers.get("authorization"));
    return new Response(null, { status: 200, headers: corsHeaders });
  } catch (e) {
    if (e instanceof OAuthFailure) return NextResponse.json(e.json(), { status: e.status, headers: corsHeaders });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: corsHeaders });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
