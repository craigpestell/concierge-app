import type { ReactNode } from "react";

/** Title row at the top of a signed-in area, with optional actions on the right. */
export function DashHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div className="dash-head">
      <div className="stack" style={{ gap: "0.4rem" }}>
        <p className="eyebrow">{eyebrow}</p>
        <h1 style={{ fontSize: "var(--step-3)" }}>{title}</h1>
      </div>
      {children && <div className="dash-actions">{children}</div>}
    </div>
  );
}

/** A row of headline numbers, such as upcoming bookings and their total. */
export function Stats({ items }: { items: { label: string; value: ReactNode; hint?: ReactNode }[] }) {
  return (
    <dl className="stats">
      {items.map((s) => (
        <div className="stat" key={s.label}>
          <dt>{s.label}</dt>
          <dd>{s.value}</dd>
          {s.hint && <dd className="hint">{s.hint}</dd>}
        </div>
      ))}
    </dl>
  );
}
