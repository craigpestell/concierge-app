import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { myProfile } from "@/lib/my-profile";
import { brand } from "@/lib/brand";
import { dayLabel } from "@/lib/format";
import { connectedApps, disconnectApp, mcpResource } from "@/lib/oauth";

export const metadata: Metadata = { title: "AI assistant" };

const HERE = "/concierge/assistant";

async function disconnect(f: FormData) {
  "use server";
  const { user } = await myProfile(HERE);
  await disconnectApp(user.id, String(f.get("clientId")));
  revalidatePath(HERE);
}

export default async function AssistantPage() {
  const { user } = await myProfile(HERE);
  const apps = await connectedApps(user.id);
  const url = mcpResource();

  return (
    <div className="dash narrow">
      <div className="stack" style={{ gap: "0.5rem" }}>
        <h2 style={{ fontSize: "var(--step-2)" }}>Manage your site from an AI app</h2>
        <p className="muted">
          Connect Claude, ChatGPT or another AI app that supports MCP connectors, then ask it in plain words. For example: “Raise my hourly rate to $55”,
          “I&apos;m away March 3 to 10”, “Change my bio to mention I&apos;m pet first aid certified” or “What&apos;s booked next week?”.
        </p>
        <p className="muted small">
          It can change your profile, rates, services, hours, time off, business phone and bookings, the same things you can change on these tabs. It can&apos;t change the
          website&apos;s design or wording. Changes go live right away.
        </p>
      </div>

      <div className="panel">
        <h3>Your connector address</h3>
        <p style={{ margin: 0, overflowWrap: "anywhere" }}><code>{url}</code></p>
        <p className="hint">You&apos;ll paste this into the AI app once. When it asks you to sign in, you&apos;ll come back to {brand.name}, sign in with your email link, and press Allow.</p>
      </div>

      <div className="panel">
        <h3>Claude</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li>On claude.ai or the Claude app, open <strong>Settings</strong>, then <strong>Connectors</strong>.</li>
          <li>Choose <strong>Add custom connector</strong>. Name it “{brand.name}” and paste the address above.</li>
          <li>Press <strong>Connect</strong>, sign in here and press <strong>Allow</strong>.</li>
          <li>In a new chat, turn the connector on from the tools menu and ask away.</li>
        </ol>
        <p className="hint">Some Claude plans limit custom connectors. If you can&apos;t add one, check your plan.</p>
      </div>

      <div className="panel">
        <h3>ChatGPT</h3>
        <ol className="small" style={{ margin: 0, paddingLeft: "1.2rem" }}>
          <li>Open <strong>Settings</strong>, then <strong>Apps</strong> (called Apps &amp; Connectors on some versions), and turn on <strong>Developer mode</strong> under Advanced settings.</li>
          <li>Back on that page, choose <strong>Create</strong>. Name it “{brand.name}”, paste the address above and pick <strong>OAuth</strong> for authentication.</li>
          <li>Sign in here and press <strong>Allow</strong>.</li>
          <li>In a new chat, pick the connector from the <strong>+</strong> menu (Developer mode) and ask away.</li>
        </ol>
        <p className="hint">Menu names change now and then. If a step looks different, search the app&apos;s help for “custom MCP connector”.</p>
      </div>

      <div className="panel" id="connected">
        <h3>Connected apps</h3>
        {apps.length ? (
          <ul className="item-list">
            {apps.map((a) => (
              <li key={a.clientId}>
                <span>
                  {a.name} <span className="muted small">· returns to {a.redirectHost} · last used {dayLabel(a.lastUsedAt)}</span>
                </span>
                <form action={disconnect}>
                  <input type="hidden" name="clientId" value={a.clientId} />
                  <button className="link-btn" type="submit">Disconnect</button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted small">No apps connected yet.</p>
        )}
        <p className="hint">Disconnecting takes effect immediately. If you see an app here you don&apos;t recognise, disconnect it.</p>
      </div>
    </div>
  );
}
