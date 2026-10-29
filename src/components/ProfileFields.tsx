import type { Service } from "@prisma/client";
import { AREAS } from "@/lib/profile-form";

type Defaults = {
  displayName?: string;
  headline?: string;
  bio?: string;
  photoUrl?: string | null;
  hourlyRateCents?: number;
  nightlyRateCents?: number | null;
  areas?: string[];
  serviceIds?: string[];
};

// Grouped into short sections so the long form is easier to scan, on setup and on the profile tab.
export function ProfileFields({ services, d = {}, stays = false }: { services: Service[]; d?: Defaults; stays?: boolean }) {
  return (
    <>
      <fieldset className="form-section">
        <legend>Name and rates</legend>
        <div className="field">
          <label htmlFor="displayName">Name customers see</label>
          <input id="displayName" name="displayName" defaultValue={d.displayName} required />
        </div>
        <div className="row">
          <div className="field">
            <label htmlFor="rate">Hourly rate ($)</label>
            <input id="rate" name="rate" type="number" min={20} max={200} step={1} defaultValue={(d.hourlyRateCents ?? 5000) / 100} required />
            <span className="hint">For errands, rides and visits booked by the hour.</span>
          </div>
          {stays && (
            <div className="field">
              <label htmlFor="nightlyRate">Overnight rate, per night ($)</label>
              <input id="nightlyRate" name="nightlyRate" type="number" min={20} max={1000} step={1} defaultValue={d.nightlyRateCents != null ? d.nightlyRateCents / 100 : ""} />
              <span className="hint">A flat fee for the roughly 8 hours you sleep at the client&apos;s home during a house or pet sitting stay. Waking hours of care are charged at your hourly rate. Leave empty to not offer stays online.</span>
            </div>
          )}
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>About you</legend>
        <div className="field">
          <label htmlFor="headline">One-line introduction</label>
          <input id="headline" name="headline" maxLength={140} defaultValue={d.headline} placeholder="e.g. Errands, pet visits and rides around Sapperton" />
        </div>
        <div className="field">
          <label htmlFor="bio">About you</label>
          <textarea id="bio" name="bio" defaultValue={d.bio} placeholder="What you enjoy helping with, how long you've lived locally, your vehicle, pets you're comfortable with…" />
        </div>
        <div className="field">
          <label htmlFor="photoUrl">Photo link (optional)</label>
          <input id="photoUrl" name="photoUrl" type="url" defaultValue={d.photoUrl ?? ""} placeholder="https://…" />
          <span className="hint">Photo uploads come later. For now, paste a link to a square photo.</span>
        </div>
      </fieldset>
      <fieldset className="form-section">
        <legend>Where and what you offer</legend>
        <fieldset className="field">
          <legend className="label">Areas you serve</legend>
          <div className="chips">
            {AREAS.map((a) => (
              <label key={a} className="check check-chip"><input type="checkbox" name="areas" value={a} defaultChecked={d.areas?.includes(a) ?? true} /> {a}</label>
            ))}
          </div>
        </fieldset>
        <fieldset className="field">
          <legend className="label">Services you offer</legend>
          <div className="chips">
            {services.map((s) => (
              <label key={s.id} className="check check-chip"><input type="checkbox" name="services" value={s.id} defaultChecked={d.serviceIds?.includes(s.id)} /> {s.name}</label>
            ))}
          </div>
        </fieldset>
      </fieldset>
    </>
  );
}
