import { createMcpHandler, getOAuthProtectedResourceMetadataUrl, OAuthError, OAuthErrorCode, requireBearerAuth } from "@modelcontextprotocol/server";
import { buildMcpServer } from "@/lib/mcp";
import { corsHeaders, findAccessToken, mcpResource, MCP_SCOPE } from "@/lib/oauth";

// The MCP server: POST JSON-RPC here with `Authorization: Bearer <token>` from /oauth/token.
// Stateless, so it runs fine as a Vercel function: each request gets a fresh server bound to the
// owner the token belongs to. Unauthenticated requests get a 401 pointing at the OAuth metadata.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Owner = NonNullable<Awaited<ReturnType<typeof findAccessToken>>>["user"];

const handler = createMcpHandler(({ authInfo }) => buildMcpServer(authInfo!.extra!.owner as Owner), {
  onerror: (e) => console.error("mcp", e),
});

const gate = () =>
  requireBearerAuth({
    verifier: {
      async verifyAccessToken(token) {
        const row = await findAccessToken(token);
        if (!row) throw new OAuthError(OAuthErrorCode.InvalidToken, "The token is unknown, expired or revoked.");
        return {
          token,
          clientId: row.clientId,
          scopes: row.scope.split(" "),
          expiresAt: Math.floor(row.accessExpiresAt.getTime() / 1000),
          resource: new URL(row.resource),
          extra: { owner: row.user },
        };
      },
    },
    requiredScopes: [MCP_SCOPE],
    expectedResource: new URL(mcpResource()),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(mcpResource())),
  });

async function serve(req: Request) {
  const auth = await gate()(req);
  const res = auth instanceof Response ? auth : await handler.fetch(req, { authInfo: auth });
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export const GET = serve;
export const POST = serve;
export const DELETE = serve;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
