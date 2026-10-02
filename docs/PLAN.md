# Concierge booking app: plan

Draft, updated 2026-10-02. Customers browse individual concierge profiles and book directly from each concierge's own calendar. The brand name isn't settled, so it lives in one config value and can be swapped.

## Who uses it

| Who | What they do |
|---|---|
| Customer | Browses concierges, filters by service and area, opens a profile, picks a time from that concierge's calendar and books it. Can see, reschedule and cancel their bookings. |
| Concierge | Edits their profile (photo, bio, services, areas, rate), sets weekly hours and time off, and sees bookings. Marks jobs done and leaves a short visit note. |
| Admin (Michelle) | Approves new concierges before their profiles go live, manages services and rate rules, and sees all bookings. Can reassign a booking if a concierge is sick. |

## How booking works

1. The customer opens a concierge's profile. The calendar shows only times that concierge is free for the whole length chosen, based on their hours, time off and existing bookings.
2. The customer books, and the booking is **Confirmed** right away. Michelle can switch this to "concierge approves first" if she prefers.
3. The customer and the concierge each get an email confirmation, and reminders go out the day before.
4. The concierge completes the job, and it becomes **Done**. The visit note goes to the customer, or to the family member who booked.

## Data

- `users`: role (customer, concierge or admin), name, phone, email
- `concierge_profiles`: user, photo, bio, hourly rate, service areas, approved, visible
- `services`: name, active. `concierge_services` links which concierges offer which services.
- `availability`: a concierge's weekly hours. `time_off`: blocked dates and times.
- `bookings`: customer, concierge, service, start, hours, address, notes, status, price estimate
- `visit_notes`: booking, text, time

## Stack (DigitalOcean)

- **App:** Next.js (TypeScript), deployed on DigitalOcean App Platform from a GitHub repo
- **Database:** DigitalOcean Managed PostgreSQL, accessed through Prisma
- **Sign-in:** email magic links (Auth.js), with no passwords to manage
- **Photos:** DigitalOcean Spaces
- **Email:** Postmark or Resend for confirmations and reminders
- **Payments:** none at first. Concierges invoice after visits. Stripe can come in phase 2.
- **Rough cost:** App Platform about $5 to $12 a month, plus managed Postgres from about $15 a month, plus Spaces at $5 a month, plus email (free tier to start)

## DNS and caching (Cloudflare)

- **DNS:** the domain's nameservers point to Cloudflare. A proxied CNAME for the root and `www` points to the App Platform app's `ondigitalocean.app` address, and the custom domain is added in App Platform as well.
- **TLS:** Cloudflare SSL mode set to Full (strict). App Platform issues its own certificate, and the domain must be added there before proxying is turned on so validation succeeds.
- **Caching, later:**
  - Cache static assets (`/_next/static/*`, images, fonts) for a long time. Next.js file names change with every deploy.
  - Bypass the cache for `/api/*`, `/book/*`, `/account/*`, `/concierge/*` (dashboard), `/admin/*`, `/auth/*`, and any request that carries a session cookie.
  - Public pages (home, services, concierge profiles) can be cached for a short time, but never the calendars on them. Open times are loaded live from `/api`.
  - Purge the Cloudflare cache after each deploy, through the deploy job or a Cloudflare API token stored as an App Platform secret.
- **Real visitor IPs:** the app reads `CF-Connecting-IP` for rate limiting on booking and sign-in.

## Phases

1. **Profiles and booking:** the public site (current design, made brand-neutral), the concierge directory and profiles, per-concierge availability and calendars, booking, emails, concierge sign-up with admin approval, and a simple admin view.
2. **Payments and reviews:** Stripe card payment at booking or after the visit, the platform fee or commission split, customer reviews on profiles, and payout reporting.
3. **Later:** calendar sync with Google or Apple for concierges, recurring bookings such as every Tuesday, and SMS reminders.

## Outside the code

Taking on concierges changes the obligations: WorkSafeBC registration, whether concierges are contractors or employees, insurance that covers them, criminal record checks, and terms for customers and concierges. The site shouldn't claim any of these until they're done.

## Needed to start

- A GitHub repo for the app. I can create a neutral `concierge-app` repo under craigpestell, so the brand name can change later.
- A DigitalOcean account to connect the repo to. Only needed when it's time to deploy.
