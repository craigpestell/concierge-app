// A small OAuth 2.1 authorization server for the MCP endpoint at /mcp.
//
// AI apps (Claude, ChatGPT, and so on) register themselves (RFC 7591), send her to /oauth/authorize,
// where she signs in with the usual email link and approves the app, then trade the one-time code
// for tokens at /oauth/token using PKCE (S256). Tokens are random strings stored only as SHA-256
// hashes. Only owner accounts (ADMIN or CONCIERGE) can approve an app.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Role } from "@prisma/client";
import { db } from "./db";
import { appUrl } from "./auth";

export const MCP_SCOPE = "site";
export const ACCESS_TOKEN_SECONDS = 60 * 60;
export const REFRESH_TOKEN_DAYS = 90;
const CODE_MINUTES = 10;

/** Roles that may connect an AI app. Customers can't. */
export const MCP_ROLES: Role[] = ["ADMIN", "CONCIERGE"];

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = (prefix: string) => `${prefix}_${randomBytes(32).toString("base64url")}`;

/** The MCP server's address, which is also its OAuth resource identifier (RFC 8707). */
export function mcpResource() {
  return `${appUrl()}/mcp`;
}

export function issuer() {
  return appUrl();
}

/** RFC 8414 metadata for this authorization server. */
export function authorizationServerMetadata() {
  const base = issuer();
  return {
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    registration_endpoint: `${base}/oauth/register`,
    revocation_endpoint: `${base}/oauth/revoke`,
    scopes_supported: [MCP_SCOPE],
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    revocation_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"],
    code_challenge_methods_supported: ["S256"],
    service_documentation: `${base}/concierge/assistant`,
  };
}

export class OAuthFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
  json() {
    return { error: this.code, error_description: this.message };
  }
}

// ---- Pure checks (unit tested) ----

/** PKCE S256: base64url(sha256(verifier)) must equal the challenge. */
export function pkceMatches(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const computed = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const want = Buffer.from(challenge);
  return computed.length === want.length && timingSafeEqual(computed, want);
}

/**
 * Redirect URIs an app may register: https anywhere, http only on loopback (desktop apps),
 * or a private app scheme such as cursor://. No fragments, no script-ish schemes.
 */
export function isAllowedRedirectUri(raw: string) {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || raw.length > 500) return false;
  const scheme = u.protocol.slice(0, -1).toLowerCase();
  if (scheme === "https") return true;
  if (scheme === "http") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (["javascript", "data", "file", "vbscript", "blob", "about", "ftp", "ws", "wss"].includes(scheme)) return false;
  return /^[a-z][a-z0-9+.-]*$/.test(scheme);
}

/**
 * Whether a redirect URI sent to /oauth/authorize matches a registered one. Exact match, except
 * that loopback URIs may use any port (RFC 8252 section 7.3).
 */
export function redirectUriRegistered(given: string, registered: string[]) {
  if (registered.includes(given)) return true;
  let g: URL;
  try {
    g = new URL(given);
  } catch {
    return false;
  }
  if (g.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(g.hostname)) return false;
  return registered.some((r) => {
    try {
      const u = new URL(r);
      return u.protocol === g.protocol && u.hostname === g.hostname && u.pathname === g.pathname && u.search === g.search;
    } catch {
      return false;
    }
  });
}

/** Resource indicators are compared without a trailing slash or fragment. */
export function sameResource(a: string, b: string) {
  const norm = (s: string) => s.split("#")[0]!.replace(/\/$/, "");
  return norm(a) === norm(b);
}

/** The scope to grant: ours, whatever the app asked for (unknown scopes are dropped, per RFC 6749). */
export function grantedScope(_requested: string | null | undefined) {
  return MCP_SCOPE;
}

// ---- Client registration ----

type RegistrationBody = {
  redirect_uris?: unknown;
  client_name?: unknown;
  token_endpoint_auth_method?: unknown;
  grant_types?: unknown;
  response_types?: unknown;
};

export async function registerClient(body: RegistrationBody) {
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (!uris.length || uris.length > 10) throw new OAuthFailure("invalid_redirect_uri", "Give between 1 and 10 redirect_uris.");
  const bad = uris.find((u) => !isAllowedRedirectUri(u));
  if (bad) throw new OAuthFailure("invalid_redirect_uri", `This redirect URI isn't allowed: ${bad}`);
  const method = typeof body.token_endpoint_auth_method === "string" ? body.token_endpoint_auth_method : "none";
  if (!["none", "client_secret_post", "client_secret_basic"].includes(method)) {
    throw new OAuthFailure("invalid_client_metadata", `Unsupported token_endpoint_auth_method: ${method}`);
  }
  const grants = Array.isArray(body.grant_types) ? body.grant_types : ["authorization_code"];
  if (grants.some((g) => g !== "authorization_code" && g !== "refresh_token")) {
    throw new OAuthFailure("invalid_client_metadata", "Only the authorization_code and refresh_token grants are supported.");
  }
  const name = (typeof body.client_name === "string" ? body.client_name : "").trim().slice(0, 80) || "Unnamed app";
  const clientId = token("mcpc");
  const secret = method === "none" ? null : token("mcps");
  await db.oAuthClient.create({
    data: { clientId, name, redirectUris: uris, tokenAuthMethod: method, secretHash: secret ? sha256(secret) : null },
  });
  return {
    client_id: clientId,
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    redirect_uris: uris,
    token_endpoint_auth_method: method,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    scope: MCP_SCOPE,
  };
}

export function findClient(clientId: string) {
  return db.oAuthClient.findUnique({ where: { clientId } });
}

/**
 * Checks the client's credentials at the token and revocation endpoints. Public clients send only
 * their client_id; confidential ones also send the secret in the body or a Basic header.
 */
export async function authenticateClient(form: URLSearchParams, authorization: string | null) {
  let clientId = form.get("client_id") ?? "";
  let secret = form.get("client_secret");
  if (authorization?.startsWith("Basic ")) {
    const decoded = Buffer.from(authorization.slice(6), "base64").toString();
    const i = decoded.indexOf(":");
    if (i > 0) {
      clientId = decodeURIComponent(decoded.slice(0, i));
      secret = decodeURIComponent(decoded.slice(i + 1));
    }
  }
  const client = clientId ? await findClient(clientId) : null;
  if (!client) throw new OAuthFailure("invalid_client", "Unknown client.", 401);
  if (client.secretHash) {
    const ok = secret && Buffer.from(sha256(secret)).equals(Buffer.from(client.secretHash));
    if (!ok) throw new OAuthFailure("invalid_client", "Wrong client secret.", 401);
  }
  return client;
}

// ---- Authorization codes ----

export type AuthorizeRequest = {
  clientId: string;
  redirectUri: string;
  state: string | null;
  codeChallenge: string;
  scope: string;
  resource: string;
};

/**
 * Checks the query on /oauth/authorize. Errors that mean we can't trust the redirect URI are
 * shown on the page; others go back to the app as ?error=.
 */
export async function readAuthorizeRequest(q: URLSearchParams): Promise<
  | { ok: true; req: AuthorizeRequest; clientName: string }
  | { ok: false; show: string }
  | { ok: false; redirect: string }
> {
  const clientId = q.get("client_id") ?? "";
  const redirectUri = q.get("redirect_uri") ?? "";
  const client = clientId ? await findClient(clientId) : null;
  if (!client) return { ok: false, show: "This app isn't registered with the site. Remove the connector and add it again." };
  if (!redirectUriRegistered(redirectUri, client.redirectUris)) return { ok: false, show: "This app sent an address that doesn't match the one it registered." };

  const state = q.get("state");
  const back = (error: string, description: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    if (state) u.searchParams.set("state", state);
    u.searchParams.set("iss", issuer());
    return { ok: false as const, redirect: u.toString() };
  };
  if (q.get("response_type") !== "code") return back("unsupported_response_type", "Only response_type=code is supported.");
  const codeChallenge = q.get("code_challenge") ?? "";
  if (q.get("code_challenge_method") !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
    return back("invalid_request", "PKCE with code_challenge_method=S256 is required.");
  }
  const resource = q.get("resource") ?? mcpResource();
  if (!sameResource(resource, mcpResource())) return back("invalid_target", `This server only issues tokens for ${mcpResource()}.`);
  return {
    ok: true,
    clientName: client.name,
    req: { clientId, redirectUri, state, codeChallenge, scope: grantedScope(q.get("scope")), resource: mcpResource() },
  };
}

/** Issues a one-time code after she approves, and returns the URL to send her back to. */
export async function approve(req: AuthorizeRequest, userId: string) {
  const code = token("mcpa");
  await db.oAuthCode.create({
    data: {
      codeHash: sha256(code),
      clientId: req.clientId,
      userId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      scope: req.scope,
      resource: req.resource,
      expiresAt: new Date(Date.now() + CODE_MINUTES * 60_000),
    },
  });
  const u = new URL(req.redirectUri);
  u.searchParams.set("code", code);
  if (req.state) u.searchParams.set("state", req.state);
  u.searchParams.set("iss", issuer());
  return u.toString();
}

export function denyUrl(req: AuthorizeRequest) {
  const u = new URL(req.redirectUri);
  u.searchParams.set("error", "access_denied");
  u.searchParams.set("error_description", "The site owner declined the connection.");
  if (req.state) u.searchParams.set("state", req.state);
  u.searchParams.set("iss", issuer());
  return u.toString();
}

// ---- Tokens ----

async function issueTokens(data: { clientId: string; userId: string; scope: string; resource: string }) {
  const access = token("mcpt");
  const refresh = token("mcpr");
  await db.oAuthToken.create({
    data: {
      ...data,
      accessHash: sha256(access),
      refreshHash: sha256(refresh),
      accessExpiresAt: new Date(Date.now() + ACCESS_TOKEN_SECONDS * 1000),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_DAYS * 86_400_000),
    },
  });
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_TOKEN_SECONDS, refresh_token: refresh, scope: data.scope };
}

async function ownerStillAllowed(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return Boolean(user && MCP_ROLES.includes(user.role));
}

/** The token endpoint: trades a code (with its PKCE verifier) or a refresh token for new tokens. */
export async function exchange(form: URLSearchParams, authorization: string | null) {
  const client = await authenticateClient(form, authorization);
  const grant = form.get("grant_type");
  if (grant === "authorization_code") {
    const code = await db.oAuthCode.findUnique({ where: { codeHash: sha256(form.get("code") ?? "") } });
    if (!code || code.clientId !== client.clientId) throw new OAuthFailure("invalid_grant", "Unknown code.");
    if (code.usedAt) {
      // A code used twice may have been stolen: cut off what the first use got.
      await db.oAuthToken.updateMany({ where: { clientId: code.clientId, userId: code.userId, createdAt: { gte: code.createdAt }, revokedAt: null }, data: { revokedAt: new Date() } });
      throw new OAuthFailure("invalid_grant", "This code was already used.");
    }
    const claimed = await db.oAuthCode.updateMany({ where: { id: code.id, usedAt: null }, data: { usedAt: new Date() } });
    if (claimed.count !== 1) throw new OAuthFailure("invalid_grant", "This code was already used.");
    if (code.expiresAt < new Date()) throw new OAuthFailure("invalid_grant", "This code has expired.");
    if ((form.get("redirect_uri") ?? code.redirectUri) !== code.redirectUri) throw new OAuthFailure("invalid_grant", "redirect_uri doesn't match.");
    if (!pkceMatches(form.get("code_verifier") ?? "", code.codeChallenge)) throw new OAuthFailure("invalid_grant", "PKCE check failed.");
    const resource = form.get("resource");
    if (resource && !sameResource(resource, code.resource)) throw new OAuthFailure("invalid_target", "resource doesn't match the authorization.");
    if (!(await ownerStillAllowed(code.userId))) throw new OAuthFailure("invalid_grant", "This account can't connect apps.");
    return issueTokens({ clientId: code.clientId, userId: code.userId, scope: code.scope, resource: code.resource });
  }
  if (grant === "refresh_token") {
    const old = await db.oAuthToken.findUnique({ where: { refreshHash: sha256(form.get("refresh_token") ?? "") } });
    if (!old || old.clientId !== client.clientId || old.revokedAt || old.refreshExpiresAt < new Date()) {
      throw new OAuthFailure("invalid_grant", "This refresh token is no longer valid. Reconnect the app.");
    }
    const rotated = await db.oAuthToken.updateMany({ where: { id: old.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (rotated.count !== 1) throw new OAuthFailure("invalid_grant", "This refresh token was already used.");
    if (!(await ownerStillAllowed(old.userId))) throw new OAuthFailure("invalid_grant", "This account can't connect apps.");
    return issueTokens({ clientId: old.clientId, userId: old.userId, scope: old.scope, resource: old.resource });
  }
  throw new OAuthFailure("unsupported_grant_type", "Use authorization_code or refresh_token.");
}

/** RFC 7009: revokes the grant behind an access or refresh token. Unknown tokens are not an error. */
export async function revoke(form: URLSearchParams, authorization: string | null) {
  const client = await authenticateClient(form, authorization);
  const h = sha256(form.get("token") ?? "");
  await db.oAuthToken.updateMany({
    where: { clientId: client.clientId, revokedAt: null, OR: [{ accessHash: h }, { refreshHash: h }] },
    data: { revokedAt: new Date() },
  });
}

/** Looks up a bearer token for /mcp. Returns the token row with its user, or null. */
export async function findAccessToken(accessToken: string) {
  const row = await db.oAuthToken.findUnique({
    where: { accessHash: sha256(accessToken) },
    include: { user: { include: { profile: true } }, client: true },
  });
  if (!row || row.revokedAt || row.accessExpiresAt < new Date() || !MCP_ROLES.includes(row.user.role)) return null;
  // Track use for the "Connected apps" list, at most once a minute.
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.oAuthToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  }
  return row;
}

/** Her connected apps, newest grant per app, for /concierge/assistant. */
export async function connectedApps(userId: string) {
  const rows = await db.oAuthToken.findMany({
    where: { userId, revokedAt: null, refreshExpiresAt: { gt: new Date() } },
    include: { client: true },
    orderBy: { createdAt: "desc" },
  });
  const byClient = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!byClient.has(r.clientId)) byClient.set(r.clientId, r);
  return [...byClient.values()].map((r) => ({
    clientId: r.clientId,
    name: r.client.name,
    redirectHost: hostOf(r.client.redirectUris[0] ?? ""),
    connectedAt: r.client.createdAt,
    lastUsedAt: r.lastUsedAt ?? r.createdAt,
  }));
}

/** Cuts an app off: every live token it holds for this user. */
export async function disconnectApp(userId: string, clientId: string) {
  await db.oAuthToken.updateMany({ where: { userId, clientId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export function hostOf(uri: string) {
  try {
    const u = new URL(uri);
    return u.host || u.protocol.replace(/:$/, "");
  } catch {
    return uri;
  }
}

/** CORS headers for the OAuth and MCP endpoints, which browser-based MCP clients call directly. */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID",
  "Access-Control-Expose-Headers": "WWW-Authenticate, Mcp-Session-Id, Mcp-Protocol-Version",
  "Access-Control-Max-Age": "86400",
};
