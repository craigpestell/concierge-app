import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isAllowedRedirectUri, pkceMatches, redirectUriRegistered, sameResource } from "./oauth";

describe("pkceMatches", () => {
  const verifier = "dBjftJeZ4CVP-mJ92K50ivjJmV4KXrXOEUKZ9dmTjxs";
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  it("accepts the right verifier", () => {
    expect(pkceMatches(verifier, challenge)).toBe(true);
  });
  it("rejects a wrong or malformed verifier", () => {
    expect(pkceMatches(verifier.replace("d", "e"), challenge)).toBe(false);
    expect(pkceMatches("short", challenge)).toBe(false);
    expect(pkceMatches("", challenge)).toBe(false);
  });
});

describe("isAllowedRedirectUri", () => {
  it("allows https, loopback http and app schemes", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(true);
    expect(isAllowedRedirectUri("https://chatgpt.com/connector_platform_oauth_redirect")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:33418/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:6274/oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("cursor://anysphere.cursor-retrieval/oauth/callback")).toBe(true);
  });
  it("refuses plain http elsewhere, fragments and script schemes", () => {
    expect(isAllowedRedirectUri("http://evil.example/cb")).toBe(false);
    expect(isAllowedRedirectUri("https://claude.ai/cb#x")).toBe(false);
    expect(isAllowedRedirectUri("javascript:alert(1)")).toBe(false);
    expect(isAllowedRedirectUri("data:text/html,hi")).toBe(false);
    expect(isAllowedRedirectUri("not a url")).toBe(false);
  });
});

describe("redirectUriRegistered", () => {
  it("needs an exact match for https", () => {
    expect(redirectUriRegistered("https://claude.ai/cb", ["https://claude.ai/cb"])).toBe(true);
    expect(redirectUriRegistered("https://claude.ai/cb2", ["https://claude.ai/cb"])).toBe(false);
    expect(redirectUriRegistered("https://claude.ai/cb?x=1", ["https://claude.ai/cb"])).toBe(false);
  });
  it("lets loopback URIs change port only", () => {
    expect(redirectUriRegistered("http://127.0.0.1:5555/cb", ["http://127.0.0.1:1234/cb"])).toBe(true);
    expect(redirectUriRegistered("http://127.0.0.1:5555/other", ["http://127.0.0.1:1234/cb"])).toBe(false);
    expect(redirectUriRegistered("http://localhost:5555/cb", ["http://127.0.0.1:1234/cb"])).toBe(false);
  });
});

describe("sameResource", () => {
  it("ignores a trailing slash and fragment", () => {
    expect(sameResource("https://royalcityconcierge.com/mcp/", "https://royalcityconcierge.com/mcp")).toBe(true);
    expect(sameResource("https://royalcityconcierge.com/mcp#a", "https://royalcityconcierge.com/mcp")).toBe(true);
    expect(sameResource("https://evil.example/mcp", "https://royalcityconcierge.com/mcp")).toBe(false);
  });
});
