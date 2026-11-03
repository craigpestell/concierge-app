import { NextResponse } from "next/server";
import { corsHeaders, exchange, OAuthFailure } from "@/lib/oauth";

const noStore = { ...corsHeaders, "Cache-Control": "no-store", Pragma: "no-cache" };

export async function POST(req: Request) {
  try {
    const form = new URLSearchParams(await req.text());
    return NextResponse.json(await exchange(form, req.headers.get("authorization")), { headers: noStore });
  } catch (e) {
    if (e instanceof OAuthFailure) return NextResponse.json(e.json(), { status: e.status, headers: noStore });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: noStore });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
