import { NextResponse } from "next/server";
import { brand } from "@/lib/brand";
import { appUrl } from "@/lib/auth";
import { corsHeaders, issuer, mcpResource, MCP_SCOPE } from "@/lib/oauth";

// RFC 9728 metadata for the MCP server at /mcp. Served at both
// /.well-known/oauth-protected-resource and /.well-known/oauth-protected-resource/mcp.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      resource: mcpResource(),
      authorization_servers: [issuer()],
      scopes_supported: [MCP_SCOPE],
      bearer_methods_supported: ["header"],
      resource_name: `${brand.name} site editor`,
      resource_documentation: `${appUrl()}/concierge/assistant`,
    },
    { headers: corsHeaders },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
