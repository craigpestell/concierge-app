# Hosting on Vercel

The site can run on Vercel with its database on Neon, instead of the droplet. Both setups
work from the same code: the droplet ignores `vercel.json`, and Vercel ignores Docker.

## What's different on Vercel

- **Build:** `npm run vercel-build` (set in `vercel.json`) applies migrations, then builds.
  Migrations use `DATABASE_URL_UNPOOLED` (Neon's direct connection) when it's set.
- **Booking reminders:** the timer in `src/instrumentation.ts` is off on Vercel. Vercel Cron
  calls `/api/cron/reminders` every 15 minutes instead, signed with `CRON_SECRET`.
- **Backups:** `.github/workflows/db-backup.yml` dumps the database nightly, encrypted, and
  keeps 14 days as workflow artifacts. Neon's own point-in-time restore covers the rest.
- **HTTPS and CDN:** Vercel's. Cloudflare records point at Vercel with the proxy off.

## Setup

1. **Vercel:** Add New > Project > import `craigpestell/concierge-app`. Framework: Next.js.
   Node.js version: the newest offered (Settings > Build and Deployment).
2. **Database:** in the project, Storage > Create Database > Neon. Pick region US East
   (Washington, D.C.), the same as the project's functions (Settings > Functions, `iad1`).
   Turn on preview branches so PR previews get their own copy, not the live data.
   This sets `DATABASE_URL` and `DATABASE_URL_UNPOOLED`.
3. **Environment variables** (Settings > Environment Variables, Production):

   | Variable | Value |
   |---|---|
   | `APP_URL` | `https://royalcityconcierge.com` |
   | `ADMIN_EMAILS` | Same as the droplet |
   | `RESEND_API_KEY` | Same as the droplet |
   | `EMAIL_FROM` | `Royal City Concierge <hello@royalcityconcierge.com>` |
   | `EMAIL_FORWARD_TOKEN` | Same as the droplet (the info@ forwarding Worker uses it) |
   | `CRON_SECRET` | New: `openssl rand -hex 24` |
   | `FEATURE_STAYS` | Same as the repository variable, if set |
   | `GA_MEASUREMENT_ID` | Only if overriding the one in `src/lib/brand.ts` |

4. **Backups:** add repository secrets `BACKUP_DATABASE_URL` (the unpooled URL) and
   `BACKUP_PASSPHRASE` (`openssl rand -hex 24`; keep a copy somewhere safe).

## Cutover

1. Check the `*.vercel.app` deployment works (it reads the empty Neon database).
2. Copy the data. On the droplet:

   ```sh
   cd /opt/concierge
   systemctl stop concierge-deploy.timer
   docker compose stop app          # nothing new is written from here on
   docker compose exec -T db pg_dump -U concierge --no-owner --clean --if-exists concierge > move.sql
   docker compose exec -T db psql "<DATABASE_URL_UNPOOLED>" < move.sql
   ```

   Compare row counts of `"User"`, `"Booking"` and `"Service"` on both sides.
3. In Vercel, Settings > Domains: add `royalcityconcierge.com` and `www.royalcityconcierge.com`.
   In Cloudflare DNS, set the records Vercel shows (usually `A @ 76.76.21.21` and
   `CNAME www cname.vercel-dns.com`) to **DNS only** (grey cloud). Don't touch the email records.
4. Test sign-in, a booking, and Admin > Emails. Watch the next cron run in Vercel > Logs.

**Rolling back:** point the DNS records back at the droplet, then on the droplet
`docker compose start app && systemctl start concierge-deploy.timer`. Bookings made on Vercel
in between would need copying back.

Keep the droplet stopped but not destroyed for a week, then destroy it and delete the
`DROPLET_*` and `POSTGRES_PASSWORD` secrets.
