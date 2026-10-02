import type { Service } from "@prisma/client";
import { AREAS } from "@/lib/profile-form";

type Defaults = {
  displayName?: string;
  headline?: string;
  bio?: string;
  photoUrl?: string | null;
  hourlyRateCents?: number;
  areas?: string[];
  serviceIds?: string[];
};

export function ProfileFields({ services, d = {} }: { services: Service[]; d?: Defaults }) {
  return (
    <>
      <div className="row">
        <div className="field">
          <label htmlFor="displayName">Name customers see</label>
          <input id="displayName" name="displayName" defaultValue={d.displayName} required />
        </div>
        <div className="field">
          <label htmlFor="rate">Hourly rate ($)</label>
          <input id="rate" name="rate" type="number" min={20} max={200} step={1} defaultValue={(d.hourlyRateCents ?? 3500) / 100} required />
        </div>
      </div>
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
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Areas you serve</legend>
        <div className="chips">
          {AREAS.map((a) => (
            <label key={a} className="check"><input type="checkbox" name="areas" value={a} defaultChecked={d.areas?.includes(a) ?? true} /> {a}</label>
          ))}
        </div>
      </fieldset>
      <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="label">Services you offer</legend>
        <div className="row">
          {services.map((s) => (
            <label key={s.id} className="check"><input type="checkbox" name="services" value={s.id} defaultChecked={d.serviceIds?.includes(s.id)} /> {s.name}</label>
          ))}
        </div>
      </fieldset>
    </>
  );
}
