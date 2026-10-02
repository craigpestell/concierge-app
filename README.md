# Royal City Concierge

Booking site for a personal concierge service in New Westminster and Burnaby. Customers browse concierge profiles and book a time from each concierge's own calendar. Concierges manage their hours, time off and bookings. An admin approves new concierges and can reassign or cancel bookings.

The brand name, contact details, time zone and booking rules all live in `src/lib/brand.ts`.

## Stack

- Next.js (App Router, TypeScript)
- PostgreSQL through Prisma
- Email sign-in links, with no passwords. Emails go through Resend, or print to the server log when `RESEND_API_KEY` is empty.
- Hosted on one DigitalOcean droplet with Docker Compose: the app, Postgres, Caddy for HTTPS, and nightly database backups. Cloudflare sits in front for DNS and caching.

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

## Deploying (one droplet + Cloudflare)

Everything runs on a single droplet from `docker-compose.yml`. Postgres is only reachable inside Docker, and the firewall allows SSH, HTTP and HTTPS. Pushing to `main` builds the image to GitHub Container Registry and deploys it (`.github/workflows/deploy.yml`). The deploy also prepares a fresh droplet with `deploy/setup-droplet.sh`.

1. With `doctl` signed in (`doctl auth init`) and, ideally, `gh` signed in, run:
   ```sh
   ./deploy/create-droplet.sh
   ```
   It creates the deploy SSH key, the droplet (`deploy/droplet.env`, first-boot setup in `deploy/cloud-init.yaml`) and a cloud firewall that allows only SSH, HTTP and HTTPS. It then stores the deploy settings as GitHub secrets and starts the Deploy workflow. Running it again changes nothing that already exists. Without `gh`, it prints the secrets to add by hand:
   - `DROPLET_HOST`, `DROPLET_SSH_KEY`: the droplet's IP and the private deploy key
   - `POSTGRES_PASSWORD`: random. Set it once and never change it, because it's fixed when the database is created.
   - `APP_URL` (`http://<droplet IP>` at first), `SITE_ADDRESS` (`:80` at first), `ADMIN_EMAILS`, and optionally `RESEND_API_KEY`
2. Pushing to `main` deploys from then on. Check `http://<droplet IP>/api/health` shows `{"ok":true}`.
3. To create it by hand instead: an Ubuntu 24.04 droplet, Basic 1 GB in Toronto, with the deploy SSH key. Then add the secrets above and run the Deploy workflow from the Actions tab.
4. Domain: in Cloudflare, add proxied A records for the domain and `www` pointing to the droplet IP, and set SSL to Full (strict). Update `APP_URL` and `SITE_ADDRESS` and deploy again. Caddy gets the HTTPS certificate on its own.
5. Caching, when you turn it on: cache `/_next/static/*` and images, and bypass `/api/*`, `/auth/*`, `/account*`, `/concierge*`, `/admin*`, `/join`, `/signin` and any request with a `session` cookie.

Backups: a dump runs every 24 hours into `/opt/concierge/backups` and is kept for 14 days. To restore one: `gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U concierge concierge`.

When it outgrows one server, move the database to a managed cluster by changing `DATABASE_URL`. The app doesn't need any other changes.

## Not built yet

- Photo uploads. Profiles take a photo link for now.
- Card payments, reviews and payouts (phase 2)
- Calendar sync, recurring bookings and SMS reminders
