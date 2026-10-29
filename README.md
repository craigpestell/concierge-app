# Royal City Concierge

Booking site for Michelle's bespoke personal concierge service in New Westminster and Burnaby. The site promotes one person: customers read about her and book a time from her calendar on the home page (also at `/book`). She manages her hours, time off and bookings. There is no concierge sign-up or approval: the admin sets up her own profile once. The database can hold several profiles, but the site only uses the first one.

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
| `/book` | Everyone | Michelle's profile and booking calendar |
| `/concierges`, `/concierges/[slug]` | Everyone | Old links; redirect to `/book` |
| `/account`, `/account/past` | Customers | Tabs for upcoming bookings (cancel) and past or cancelled ones |
| `/concierge/setup` | Admins | Set up the owner's profile once (published right away) |
| `/concierge` | Concierges | "My schedule" tabs: Bookings (close out with a note, cancel) |
| `/concierge/availability`, `/concierge/profile`, `/concierge/phone` | Concierges | Weekly hours and time off; profile and rates; business phone |
| `/admin`, `/admin/services` | Admins | Tabs for upcoming bookings (cancel) and services (add, hide) |

## How booking works

Open times come from the concierge's weekly hours, minus existing bookings and time off. They start at least 12 hours from now and run up to 8 weeks out (`src/lib/slots.ts`). A booking re-checks the time inside a serializable transaction, so two people can't book the same slot.

### Overnight stays (feature flag)

House and pet sitting where she stays at the client's home is booked as a date range: the client taps the arrival day and the day they're back, and estimates how many waking hours of care each day needs (1 to 16, `brand.stayCareHours`). Each night is priced as those hours at her hourly rate plus her flat overnight rate, which covers the roughly 8 hours she sleeps there; the estimate is what the client sees, and she bills the hours actually worked. The care hours are stored in `Booking.hours`. A stay blocks every day it touches, from midnight on the arrival day to midnight after the last day, so no hourly visits land on those days either. Weekly hours don't apply to stays. Stays can start tomorrow at the earliest, must end inside the 8-week window, and run up to 30 nights (`brand.maxStayNights`).

Stays are off unless `FEATURE_STAYS=on`. On the droplet, set the repository variable `FEATURE_STAYS` to `on` (Settings > Secrets and variables > Actions > Variables) and run the Droplet setup workflow. Once it's on, she sets an overnight rate on the Profile & rates tab (`/concierge/profile`); leaving the rate empty keeps stays off her booking page.

## Deploying (one droplet + Cloudflare)

Everything runs on a single droplet from `docker-compose.yml`. Postgres is only reachable inside Docker, and the firewall allows SSH, HTTP and HTTPS.

Deploys are pulled, not pushed. When CI passes on `main`, it publishes the image to GitHub Container Registry as `ghcr.io/craigpestell/concierge-app:<sha>`. Every 5 minutes the droplet checks for a newer green commit on `main` and deploys it (`deploy/pull-deploy.sh`, installed as `concierge-deploy` with a systemd timer). Each deploy dumps the database, starts the new image, and waits for its health check. If it isn't healthy, it rolls back to the previous release and skips that commit until `main` moves on. GitHub never connects to the server to deploy.

The **Droplet setup** workflow (`.github/workflows/deploy.yml`, run by hand) prepares a droplet with `deploy/setup-droplet.sh`, installs the pull deploy, and writes the settings from GitHub secrets and variables. Run it again whenever a setting changes.

1. With `doctl` signed in (`doctl auth init`) and, ideally, `gh` signed in, run:
   ```sh
   ./deploy/create-droplet.sh
   ```
   It creates the deploy SSH key, the droplet (`deploy/droplet.env`, first-boot setup in `deploy/cloud-init.yaml`) and a cloud firewall that allows only SSH, HTTP and HTTPS. It then stores the deploy settings as GitHub secrets and starts the Droplet setup workflow, which deploys the newest green commit. Running it again changes nothing that already exists. Without `gh`, it prints the secrets to add by hand:
   - `DROPLET_HOST`, `DROPLET_SSH_KEY`: the droplet's IP and the private deploy key
   - `POSTGRES_PASSWORD`: random. Set it once and never change it, because it's fixed when the database is created.
   - `APP_URL` (`http://<droplet IP>` at first), `SITE_ADDRESS` (`:80` at first), `ADMIN_EMAILS`, and optionally `RESEND_API_KEY`
2. Merging to `main` deploys from then on, within about 5 minutes of CI passing. Check `http://<droplet IP>/api/health` shows `{"ok":true}`.
3. To create it by hand instead: an Ubuntu 24.04 droplet, Basic 1 GB in Toronto, with the deploy SSH key. Then add the secrets above and run the Droplet setup workflow from the Actions tab.
4. Domain: in Cloudflare, add proxied A records for the domain and `www` pointing to the droplet IP, and set SSL to Full (strict). Update `APP_URL` and `SITE_ADDRESS` and run the Droplet setup workflow again. Caddy gets the HTTPS certificate on its own.
5. Caching, when you turn it on: cache `/_next/static/*` and images, and bypass `/api/*`, `/auth/*`, `/account*`, `/concierge*`, `/admin*`, `/signin` and any request with a `session` cookie.

On the droplet:

- `concierge-deploy --status` shows the live and previous release and the last run's outcome. `journalctl -u concierge-deploy` has the logs.
- `concierge-deploy --rollback` goes back to the previous release. Migrations are not reversed, so a rollback past a migration needs the `pre-deploy-<sha>.sql.gz` dump in `backups/`.
- `concierge-deploy <sha>` deploys a specific commit that CI published.
- If the container package is private, save a token with `read:packages` to `/etc/concierge-deploy/ghcr-token` (mode 600). Making the package public (the repository already is) avoids that.

Backups: a dump runs every 24 hours into `/opt/concierge/backups` and is kept for 14 days. To restore one: `gunzip -c backups/<file>.sql.gz | docker compose exec -T db psql -U concierge concierge`.

When it outgrows one server, move the database to a managed cluster by changing `DATABASE_URL`. The app doesn't need any other changes.

## Not built yet

- Photo uploads. Profiles take a photo link for now.
- Card payments, reviews and payouts (phase 2)
- Calendar sync, recurring bookings and SMS reminders
