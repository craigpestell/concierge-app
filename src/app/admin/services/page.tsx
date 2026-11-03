import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { addService as saveService, setServiceActive, tryEdit } from "@/lib/site-edits";

export const metadata: Metadata = { title: "Services" };

const admin = () => requireUser(["ADMIN"], "/admin/services");

async function addService(f: FormData) {
  "use server";
  await admin();
  await tryEdit(() => saveService(String(f.get("name") ?? "")));
  revalidatePath("/admin/services");
}

async function toggleService(f: FormData) {
  "use server";
  await admin();
  await tryEdit(() => setServiceActive(String(f.get("id")), f.get("active") === "true"));
  revalidatePath("/admin/services");
}

export default async function ServicesPage() {
  await admin();
  const services = await db.service.findMany({ orderBy: { sort: "asc" } });

  return (
    <div className="panel narrow">
      <div className="stack" style={{ gap: "0.4rem" }}>
        <h2 style={{ fontSize: "var(--step-2)" }}>Services</h2>
        <p className="muted small">The services clients can pick when they book. Hidden ones drop off the booking page but stay on past bookings.</p>
      </div>
      <ul className="item-list">
        {services.map((s) => (
          <li key={s.id}>
            <span>{s.name} {!s.active && <span className="pill">Hidden</span>}</span>
            <form action={toggleService}>
              <input type="hidden" name="id" value={s.id} />
              <input type="hidden" name="active" value={String(!s.active)} />
              <button className="link-btn" type="submit">{s.active ? "Hide" : "Show"}</button>
            </form>
          </li>
        ))}
      </ul>
      <form action={addService} className="add-row">
        <div className="field">
          <label htmlFor="svc-name">Add a service</label>
          <input id="svc-name" name="name" placeholder="e.g. Holiday decorating" required />
        </div>
        <button className="btn btn-sm" type="submit">Add service</button>
      </form>
    </div>
  );
}
