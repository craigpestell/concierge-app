# MCP server: manage the site from an AI app

The site runs a remote [MCP](https://modelcontextprotocol.io) server at **`https://royalcityconcierge.com/mcp`**.
The owner connects it from Claude, ChatGPT or any MCP client and manages her own site data in plain words.

## What it can and can't do

Tools (`src/lib/mcp.ts`), all acting on the signed-in owner's own profile:

| Tool | Does |
| --- | --- |
| `get_site` | Profile, rates, services, areas, phone, weekly hours, time off, booking counts |
| `list_services` | Booking menu, shown/hidden, whether she offers each |
| `set_up_profile` | Creates the profile if there isn't one (admin only) |
| `update_profile` | Name, headline, bio, photo link, hourly and overnight rates, areas, services, taking bookings |
| `set_weekly_hours` | Replaces weekly hours (half hours, 06:00 to 21:00) |
| `add_time_off` / `remove_time_off` | Blocks whole days |
| `set_business_phone` / `clear_business_phone` | Public business number |
| `add_service` / `set_service_shown` | Booking menu (admin only) |
| `list_bookings` | Upcoming, to close out, or past, with client contact details |
| `mark_booking_done` / `cancel_booking` | Emails the client, so clients are told to confirm first |

It can't change code, design, page wording (`src/lib/content.ts`) or deploys. Every tool uses the same
checks as the web pages (`src/lib/site-edits.ts`, `validateProfile` in `src/lib/profile-form.ts`).

## Auth

The site is its own OAuth 2.1 authorization server (`src/lib/oauth.ts`):

- Discovery: `/.well-known/oauth-protected-resource/mcp` (RFC 9728) and `/.well-known/oauth-authorization-server` (RFC 8414).
- Apps register themselves at `/oauth/register` (RFC 7591). Registering grants nothing.
- `/oauth/authorize` asks her to sign in with the usual email link, then shows an Allow/Decline page with the app's return address. Only `ADMIN` and `CONCIERGE` accounts can approve; customers are refused.
- `/oauth/token` swaps the code (PKCE S256 required) or a refresh token for tokens. Access tokens last an hour, refresh tokens 90 days and rotate on each use. A reused code or refresh token kills the grant.
- Tokens are random strings stored as SHA-256 hashes (`OAuthToken`). Demoting the account or pressing Disconnect on **My schedule → AI assistant** (`/concierge/assistant`) cuts the app off at once.

The `/mcp` route is stateless (`createMcpHandler` from `@modelcontextprotocol/server` v2), so it runs as a
normal Vercel function. It serves both the 2026-07-28 protocol and older 2025 clients.

No new environment variables. `APP_URL` must be the public address (it is the OAuth issuer and resource).

## Connecting (for Michelle)

The same steps are on `/concierge/assistant`.

**Claude:** Settings → Connectors → Add custom connector. Name it "Royal City Concierge", paste
`https://royalcityconcierge.com/mcp`, press Connect, sign in, press Allow. Turn it on in a chat from the tools menu.

**ChatGPT:** Settings → Apps → Advanced settings → turn on Developer mode. Then Create, paste the same
address, choose OAuth, sign in, press Allow. Pick it from the + menu in a chat.

## Testing locally

```bash
npx @modelcontextprotocol/inspector   # point it at http://localhost:3000/mcp
```
