"use client";

import { useEffect, useMemo, useState } from "react";

type Props = {
  slug: string;
  conciergeName: string;
  services: { slug: string; name: string }[];
  initialService: string;
  rateCents: number;
  lengths: number[];
  window: { first: string; last: string };
  timeZone: string;
  prefill: { name: string; email: string; phone: string } | null;
  /** Overnight stays, when the feature is on and she has a nightly rate. */
  stay?: { rateCents: number; first: string; last: string; maxNights: number } | null;
};

type Done = { when: string; service: string; concierge: string; estimate: string; email: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ym = (date: string) => date.slice(0, 7);
function monthBounds(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { y, m, days, from: `${month}-01`, to: `${month}-${pad(days)}`, lead: new Date(Date.UTC(y, m - 1, 1)).getUTCDay() };
}
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}
const money = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
const nightsBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const nightsLabel = (n: number) => (n === 1 ? "1 night" : `${n} nights`);
function addDays(date: string, by: number) {
  const d = new Date(Date.parse(`${date}T00:00:00Z`) + by * 86_400_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

const firstName = (name: string) => name.split(" ")[0]!;
const STAY_SERVICES = ["pets-plants", "home-checks"];

export function BookingCalendar(p: Props) {
  const [service, setService] = useState(p.initialService);
  const [hours, setHours] = useState(p.lengths.includes(2) ? 2 : p.lengths[0]!);
  const [month, setMonth] = useState(ym(p.window.first));
  const [days, setDays] = useState<Record<string, string[]> | null>(null);
  const [loadError, setLoadError] = useState("");
  const [date, setDate] = useState<string | null>(null);
  const [start, setStart] = useState<string | null>(null);
  const [form, setForm] = useState({ name: p.prefill?.name ?? "", email: p.prefill?.email ?? "", phone: p.prefill?.phone ?? "", address: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);
  const [mode, setMode] = useState<"visit" | "stay">("visit");
  const [blocked, setBlocked] = useState<Set<string> | null>(null);
  const [firstDay, setFirstDay] = useState<string | null>(null);
  const [lastDay, setLastDay] = useState<string | null>(null);
  const stay = mode === "stay" && p.stay ? p.stay : null;

  const fmt = useMemo(
    () => ({
      month: new Intl.DateTimeFormat("en-CA", { month: "long", year: "numeric", timeZone: "UTC" }),
      day: new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" }),
      time: new Intl.DateTimeFormat("en-CA", { hour: "numeric", minute: "2-digit", timeZone: p.timeZone }),
    }),
    [p.timeZone],
  );
  const timeLabel = (iso: string) => fmt.time.format(new Date(iso)).replace(/\s?([ap])\.?m\.?/i, (_, x: string) => ` ${x.toLowerCase()}m`);
  const dayLabel = (d: string) => fmt.day.format(new Date(`${d}T12:00:00Z`));
  const endOf = (iso: string) => new Date(new Date(iso).getTime() + hours * 3600_000).toISOString();

  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    const b = monthBounds(month);
    const ctrl = new AbortController();
    setDays(null);
    setLoadError("");
    fetch(`/api/concierges/${p.slug}/availability?from=${b.from}&to=${b.to}&hours=${hours}`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't load the calendar.");
        setDays(body.days);
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadError(e.message || "Couldn't load the calendar. Check your connection and try again.");
      });
    return () => ctrl.abort();
  }, [month, hours, p.slug, reloadKey]);

  // Stays need every day in the window at once, since a stay can cross into the next month.
  useEffect(() => {
    if (mode !== "stay") return;
    const ctrl = new AbortController();
    setBlocked(null);
    setLoadError("");
    fetch(`/api/concierges/${p.slug}/stays`, { signal: ctrl.signal })
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? "Couldn't load the calendar.");
        setBlocked(new Set(body.blocked as string[]));
      })
      .catch((e: Error) => {
        if (e.name !== "AbortError") setLoadError(e.message || "Couldn't load the calendar. Check your connection and try again.");
      });
    return () => ctrl.abort();
  }, [mode, p.slug, reloadKey]);

  // Drop a picked day or time that is no longer open after the length changes.
  useEffect(() => {
    if (!days || !date || ym(date) !== month) return;
    if (!days[date]) {
      setDate(null);
      setStart(null);
    } else if (start && !days[date].includes(start)) setStart(null);
  }, [days, date, start, month]);

  const b = monthBounds(month);
  const canPrev = month > ym(p.window.first);
  const canNext = month < ym(p.window.last);
  const serviceName = p.services.find((s) => s.slug === service)?.name ?? "";
  const nights = firstDay && lastDay ? nightsBetween(firstDay, lastDay) : 0;
  const ready = stay ? nights > 0 : Boolean(date && start);
  const estimateCents = stay ? stay.rateCents * nights : p.rateCents * hours;

  const stayDayOpen = (d: string) => Boolean(stay && blocked && d >= stay.first && d <= stay.last && !blocked.has(d));
  /** Whether a stay from the picked arrival day can run through `d`. */
  const stayReaches = (d: string) => {
    if (!stay || !firstDay || d <= firstDay || nightsBetween(firstDay, d) > stay.maxNights) return false;
    for (let x = firstDay; x <= d; x = addDays(x, 1)) if (!stayDayOpen(x)) return false;
    return true;
  };
  function pickStayDay(d: string) {
    if (firstDay && !lastDay && stayReaches(d)) setLastDay(d);
    else {
      setFirstDay(d);
      setLastDay(null);
    }
  }
  function switchMode(m: "visit" | "stay") {
    setMode(m);
    // Most stays are pet and house sitting, so start on that service when she offers it.
    const sitting = STAY_SERVICES.find((slug) => p.services.some((s) => s.slug === slug));
    if (m === "stay" && sitting) setService(sitting);
    setError("");
    setDate(null);
    setStart(null);
    setFirstDay(null);
    setLastDay(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready) return;
    if (!form.name.trim() || !form.email.trim() || !form.address.trim()) {
      setError(stay ? "Add your name, email and the address of the home." : "Add your name, email and where to meet you.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          stay
            ? { kind: "stay", conciergeSlug: p.slug, serviceSlug: service, firstDay, lastDay, ...form }
            : { kind: "visit", conciergeSlug: p.slug, serviceSlug: service, start, hours, ...form },
        ),
      });
      const body = await r.json();
      if (!r.ok) {
        setError(body.error ?? "Something went wrong. Please try again.");
        if (r.status === 409 || /taken|just booked/i.test(body.error ?? "")) {
          setStart(null);
          setLastDay(null);
          setReloadKey((k) => k + 1);
        }
        return;
      }
      setDone(body);
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="done-box" role="status">
        <p className="eyebrow">You're booked</p>
        <h3 style={{ fontSize: "var(--step-2)" }}>{done.when}</h3>
        <p className="muted">
          {done.service} with {done.concierge}, estimated {done.estimate}. A confirmation is on its way to {done.email}.
        </p>
        <div className="actions">
          <a className="btn btn-ghost" href="/account">See my bookings</a>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setDone(null);
              setDate(null);
              setStart(null);
              setFirstDay(null);
              setLastDay(null);
              setReloadKey((k) => k + 1);
            }}
          >
            Book another time
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="booker">
        <div className="bk-col bk-svc">
          <div className="bk-step"><b>1</b> What do you need?</div>
          <div className="chips" role="group" aria-label="Service">
            {p.services.map((s) => (
              <button key={s.slug} type="button" className="chip" aria-pressed={s.slug === service} onClick={() => setService(s.slug)}>
                {s.name}
              </button>
            ))}
          </div>
          {p.stay && (
            <>
              <div className="bk-label" id="kind-label">Visit or stay?</div>
              <div className="chips" role="group" aria-labelledby="kind-label">
                <button type="button" className="chip" aria-pressed={mode === "visit"} onClick={() => switchMode("visit")}>By the hour</button>
                <button type="button" className="chip" aria-pressed={mode === "stay"} onClick={() => switchMode("stay")}>Overnight stay at your home</button>
              </div>
            </>
          )}
          {stay ? (
            <p className="bk-est">
              {nights ? <>Estimate: <strong>{money(estimateCents)}</strong> ({nights} × {money(stay.rateCents)}/night). </> : <><strong>{money(stay.rateCents)}</strong> per night. </>}
              {firstName(p.conciergeName)} stays at your home to look after pets, plants and the house while you&apos;re away.
            </p>
          ) : (
            <>
              <div className="bk-label" id="len-label">How long?</div>
              <div className="chips" role="group" aria-labelledby="len-label">
                {p.lengths.map((h) => (
                  <button key={h} type="button" className="chip" aria-pressed={h === hours} onClick={() => setHours(h)}>
                    {h === 1 ? "1 hour" : `${h} hours`}
                  </button>
                ))}
              </div>
              <p className="bk-est">
                Estimate: <strong>{money(p.rateCents * hours)}</strong> ({hours} × {money(p.rateCents)}/hr). Longer drives may add mileage.
              </p>
            </>
          )}
        </div>

        <div className="bk-col bk-cal">
          <div className="bk-step"><b>2</b> {stay ? "Choose your dates" : "Choose a day"}</div>
          <div className="cal-head">
            <button className="cal-nav" type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => setMonth(shiftMonth(month, -1))}>‹</button>
            <span className="m" aria-live="polite">{fmt.month.format(new Date(Date.UTC(b.y, b.m - 1, 15)))}</span>
            <button className="cal-nav" type="button" aria-label="Next month" disabled={!canNext} onClick={() => setMonth(shiftMonth(month, 1))}>›</button>
          </div>
          <div className="cal-grid" aria-busy={stay ? blocked === null : days === null}>
            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i} className="cal-dow">{d}</div>)}
            {Array.from({ length: b.lead }, (_, i) => <div key={`l${i}`} />)}
            {Array.from({ length: b.days }, (_, i) => {
              const d = `${month}-${pad(i + 1)}`;
              if (stay) {
                const open = stayDayOpen(d);
                const inRange = Boolean(firstDay && lastDay && d > firstDay && d < lastDay);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`cal-day${inRange ? " in-range" : ""}`}
                    disabled={!open}
                    aria-pressed={d === firstDay || d === lastDay || inRange}
                    aria-label={`${dayLabel(d)}${open ? "" : ", not available"}`}
                    onClick={() => pickStayDay(d)}
                  >
                    {i + 1}
                  </button>
                );
              }
              const open = Boolean(days?.[d]?.length);
              return (
                <button
                  key={d}
                  type="button"
                  className="cal-day"
                  disabled={!open}
                  aria-pressed={d === date}
                  aria-label={`${dayLabel(d)}${open ? "" : ", no open times"}`}
                  onClick={() => {
                    setDate(d);
                    setStart(null);
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          {loadError && <p className="error small">{loadError}</p>}
          {!stay && days && Object.keys(days).length === 0 && !loadError && (
            <p className="muted small">No open times this month for {hours === 1 ? "1 hour" : `${hours} hours`}. Try a shorter booking or the next month.</p>
          )}
        </div>

        <div className="bk-col bk-time">
          <div className="bk-step"><b>3</b> {stay ? "Your stay" : "Choose a time"}</div>
          <div className="slots">
            {stay ? (
              !firstDay ? (
                <p className="muted small">Tap the day {firstName(p.conciergeName)} should arrive, then the day you&apos;re back. Stays can be up to {stay.maxNights} nights.</p>
              ) : (
                <dl className="stay-dates">
                  <div><dt>Arrives</dt><dd>{dayLabel(firstDay)}</dd></div>
                  <div><dt>Leaves</dt><dd>{lastDay ? dayLabel(lastDay) : "Now tap the day you're back"}</dd></div>
                  {nights > 0 && <div><dt>Length</dt><dd>{nightsLabel(nights)}</dd></div>}
                </dl>
              )
            ) : !date || !days?.[date] ? (
              <p className="muted small">Pick a day to see open times.</p>
            ) : (
              <>
                <p className="bk-label">{dayLabel(date)}</p>
                {days[date].map((iso) => (
                  <button key={iso} type="button" className="slot" aria-pressed={iso === start} onClick={() => setStart(iso)}>
                    {timeLabel(iso)} – {timeLabel(endOf(iso))}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <form className="bk-details" onSubmit={submit} noValidate>
        <div className="form">
          <div className="bk-step"><b>4</b> Your details</div>
          <div className="row">
            <div className="field">
              <label htmlFor="b-name">Your name</label>
              <input id="b-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </div>
            <div className="field">
              <label htmlFor="b-email">Email</label>
              <input id="b-email" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
          </div>
          <div className="row">
            <div className="field">
              <label htmlFor="b-phone">Phone (optional)</label>
              <input id="b-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="field">
              <label htmlFor="b-where">{stay ? "Address of the home" : "Where should we meet you?"}</label>
              <input id="b-where" autoComplete="street-address" placeholder={stay ? "Street address and city" : "Address or neighbourhood"} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
            </div>
          </div>
          <div className="field">
            <label htmlFor="b-notes">{stay ? "Tell us about the pets and the home" : "What needs doing?"}</label>
            <textarea id="b-notes" placeholder={stay ? "e.g. Two cats, one needs pills at breakfast. Water the tomatoes. Back around 6 pm on the last day." : "e.g. Costco run for my dad. He'll have a list ready."} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="summary" aria-live="polite">
          <p className="eyebrow">Your booking</p>
          <dl>
            <div><dt>With</dt><dd>{p.conciergeName}</dd></div>
            <div><dt>Service</dt><dd>{serviceName}</dd></div>
            {stay ? (
              <>
                <div><dt>When</dt><dd>{ready ? `${dayLabel(firstDay!)} to ${dayLabel(lastDay!)}` : "Choose your dates"}</dd></div>
                <div><dt>Estimate</dt><dd>{ready ? `${money(estimateCents)} for ${nightsLabel(nights)}` : `${money(stay.rateCents)} per night`}</dd></div>
              </>
            ) : (
              <>
                <div><dt>When</dt><dd>{ready ? `${dayLabel(date!)}, ${timeLabel(start!)} – ${timeLabel(endOf(start!))}` : date ? `${dayLabel(date)}, choose a time` : "Choose a day and time"}</dd></div>
                <div><dt>Estimate</dt><dd>{money(p.rateCents * hours)} for {hours === 1 ? "1 hour" : `${hours} hours`}</dd></div>
              </>
            )}
          </dl>
          <button className="btn btn-brass" type="submit" disabled={!ready || submitting}>
            {submitting ? "Booking…" : stay ? "Book this stay" : "Book this time"}
          </button>
          <p className={`msg${error ? " err" : ""}`} role={error ? "alert" : undefined}>
            {error || `Nothing is charged now. You pay after the ${stay ? "stay" : "visit"}.`}
          </p>
        </div>
      </form>
    </div>
  );
}
