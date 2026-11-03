import { NextResponse } from "next/server";
import { authorizationServerMetadata, corsHeaders } from "@/lib/oauth";

// RFC 8414 discovery for the MCP server's authorization server (this site).
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(authorizationServerMetadata(), { headers: corsHeaders });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
