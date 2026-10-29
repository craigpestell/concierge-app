# Project profile

Both roles read this file first. It holds everything specific to the concierge app, so the shared Lite agents from [company-kit](https://github.com/craigpestell/company-kit) stay generic. `engineering-lead` keeps it current.

## Product

- **Name:** Royal City Concierge (repository `concierge-app`).
- **What it is:** a booking site for Michelle's personal concierge service in New Westminster and Burnaby. Customers read about her and book a time; she manages her hours, time off and bookings. Optional overnight stays (house and pet sitting) behind `FEATURE_STAYS`.
- **Owner:** the founder builds it for Michelle, unbilled, so it runs on the Lite team. Michelle is the client; anything she sees or relies on is hers to approve through the founder.
- **Stage:** alpha, no customers yet (2026-10-29).

## Stack

- Next.js (App Router, TypeScript), PostgreSQL through Prisma, email sign-in links through Resend, Vitest. Node 26 (`.nvmrc`).
- Code map: `src/app/` (pages and API routes: `book`, `account`, `concierge`, `admin`, `api/health`), `src/lib/` (booking rules in `slots.ts` and `availability.ts`, `auth.ts`, `email.ts`, `features.ts`, and `brand.ts` for the name, contact details, time zone and booking rules), `src/components/`, `prisma/`, `deploy/` (droplet scripts and pull deploy), `docs/PLAN.md` (the original plan).

## Commands

| What | Command |
| --- | --- |
| Install | `npm ci` |
| Dev server | `npm run dev` (needs a local Postgres in `DATABASE_URL`) |
| Migrate local database | `npm run db:migrate` |
| Type-check | `npm run typecheck` |
| Tests | `npm test` |
| Build | `npm run build` |

## Hosting and deploys

- **Host:** one DigitalOcean droplet running Docker Compose (app, Postgres, Caddy, nightly backups), with Cloudflare in front. Company skills: `digitalocean-deploy` (Compose style) and `digitalocean-droplet-setup`.
- **How a change reaches production:** merge to `main`. CI checks it and publishes `ghcr.io/craigpestell/concierge-app:<sha>`; the droplet deploys the newest green commit within about 5 minutes, health-checks it, and rolls back on failure.
- **Rollback:** on the droplet, `concierge-deploy --rollback`. Migrations are not reversed; each deploy leaves a `pre-deploy-<sha>.sql.gz` dump in `/opt/concierge/backups`.
- **Settings:** GitHub repository secrets and variables, applied by running the **Droplet setup** workflow by hand. Feature flags such as `FEATURE_STAYS` are repository variables.
- **Where secrets live:** GitHub secrets, written to `/opt/concierge/.env` (mode 600) on the droplet. `POSTGRES_PASSWORD` is fixed once the database exists; never change it.

## Rules every role keeps

- Booking times are in the time zone in `brand.ts`; keep slot and availability logic covered by tests.
- Sign-in is by emailed link only; no passwords.
- No personal details (names, emails, phone numbers, booking notes) go to Google Analytics or any third party except Resend for email.
- Brand, contact details and booking rules live in `brand.ts`, not scattered through pages.

## Deploy gate

- CI (`check` and `docker` jobs in `ci.yml`) green on the exact commit. The droplet only deploys green commits.
- `qa-engineer` has verified the change.
- No role approves its own work.
- Merging is deploying. `engineering-lead` merges once the gate passes; ask the founder first for anything on the list below. (Assumption made at onboarding, 2026-10-29, while the site is in alpha with no customers. The founder can tighten it.)

## What only the founder approves

- Spending money (droplet size, backups, paid email) and publishing anything public, such as a domain or announcement
- Anything Michelle will see or rely on: wording about her, prices, booking rules, emails sent to customers
- Changing the database password, the droplet, DNS or Cloudflare settings

## Analytics

Google Analytics 4 with consent mode, from `src/lib/analytics.ts` and `src/components/Analytics.tsx` (the reference for the kit's `google-analytics` skill). Measurement ID in `brand.ts`, overridable with `GA_MEASUREMENT_ID`.
