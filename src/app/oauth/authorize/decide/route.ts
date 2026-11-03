import { appUrl, currentUser } from "@/lib/auth";
import { approve, denyUrl, MCP_ROLES, readAuthorizeRequest } from "@/lib/oauth";

// Her answer on /oauth/authorize. A plain form post (not a server action) so the 303 can send her
// to any redirect URI the app registered, including app schemes like cursor://.
export async function POST(req: Request) {
  // Only accept the form from our own page. The session cookie is SameSite=Lax as well.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(appUrl()).origin) return new Response("Forbidden", { status: 403 });

  const form = await req.formData();
  const q = new URLSearchParams(String(form.get("query") ?? ""));
  const user = await currentUser();
  if (!user) return seeOther(`${appUrl()}/signin?next=${encodeURIComponent(`/oauth/authorize?${q}`)}`);
  if (!MCP_ROLES.includes(user.role)) return seeOther(`${appUrl()}/oauth/authorize?${q}`);

  const read = await readAuthorizeRequest(q);
  if (!read.ok) return seeOther("redirect" in read ? read.redirect : `${appUrl()}/oauth/authorize?${q}`);
  return seeOther(form.get("decision") === "approve" ? await approve(read.req, user.id) : denyUrl(read.req));
}

function seeOther(location: string) {
  return new Response(null, { status: 303, headers: { Location: location, "Cache-Control": "no-store" } });
}
