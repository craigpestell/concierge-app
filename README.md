# Royal City Concierge

Booking site for a personal concierge service in New Westminster and Burnaby. Customers browse concierge profiles and book a time from each concierge's own calendar. Concierges manage their hours, time off and bookings. An admin approves new concierges and can reassign or cancel bookings.

The brand name, contact details, time zone and booking rules all live in `src/lib/brand.ts`.

## Stack

- Next.js (App Router, TypeScript)
- PostgreSQL through Prisma
- Email sign-in links, with no passwords. Emails go through Resend, or print to the server log when `RESEND_API_KEY` is empty.
- Hosted on DigitalOcean App Platform (`.do/app.yaml`), with Cloudflare in front for DNS and caching

## Run it locally

```sh
cp .env.example .env          # point DATABASE_URL at a local Postgres
npm install
npx prisma migrate dev
SEED_DEMO=1 npm run db:seed   # services, plus three sample concierges
npm run dev
```

Sign in at `/signin`. The sign-in link prints in the terminal. Add your email to `ADMIN_EMAILS` to get the admin page.

## Checks

```sh
npm run typecheck
npm test        # slot and time-zone logic
npm run build
```

## Pages

| Path | Who | What |
|---|---|---|
| `/` | Everyone | Home page |
| `/concierges` | Everyone | Directory, filtered by service and area |
| `/concierges/[slug]` | Everyone | Profile and booking calendar |
| `/account` | Customers | Upcoming and past bookings, cancel |
| `/join` | Anyone signed in | Apply to be a concierge |
| `/concierge` | Concierges | Bookings, weekly hours, time off, profile |
| `/admin` | Admins | Approve concierges, reassign or cancel bookings, manage services |

## How booking works

Open times come from the concierge's weekly hours, minus existing bookings and time off. They start at least 12 hours from now and run up to 8 weeks out (`src/lib/slots.ts`). A booking re-checks the time inside a serializable transaction, so two people can't book the same slot.

## Deploying (DigitalOcean + Cloudflare)

1. Create a managed PostgreSQL cluster named `concierge-db` in Toronto (tor1). The smallest Basic size is enough to start.
2. Create the app from `.do/app.yaml` (`doctl apps create --spec .do/app.yaml`, or paste the spec into the console). It attaches `concierge-db`, and migrations run on each start. The migrations also add the starting list of services.
3. Set `APP_URL` to the public URL, `ADMIN_EMAILS`, and the `RESEND_API_KEY` secret.
4. Add the custom domain in App Platform first. Then, in Cloudflare, add a proxied CNAME to the app's `ondigitalocean.app` hostname and set SSL to Full (strict).
5. Caching, when you turn it on: cache `/_next/static/*` and images, and bypass `/api/*`, `/auth/*`, `/account*`, `/concierge*`, `/admin*`, `/join`, `/signin` and any request with a `session` cookie.

## Not built yet

- Photo uploads. Profiles take a photo link for now.
- Card payments, reviews and payouts (phase 2)
- Calendar sync, recurring bookings and SMS reminders
