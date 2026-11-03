import { NextResponse } from "next/server";
import { corsHeaders, OAuthFailure, registerClient } from "@/lib/oauth";

// RFC 7591 dynamic client registration, which Claude, ChatGPT and other MCP clients use to sign up
// before sending her to /oauth/authorize. Registering grants nothing: she still has to approve.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") throw new OAuthFailure("invalid_client_metadata", "Send the client metadata as JSON.");
    return NextResponse.json(await registerClient(body), { status: 201, headers: corsHeaders });
  } catch (e) {
    if (e instanceof OAuthFailure) return NextResponse.json(e.json(), { status: e.status, headers: corsHeaders });
    console.error(e);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: corsHeaders });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
