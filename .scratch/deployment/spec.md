# Trial deployment on Railway

Status: ready

Decided on 2026-09-25 by grilling. Decision recorded in
`docs/adr/0008-railway-single-hosting-provider.md`. This picks up the image
deferred by `.scratch/hono-backend/issues/05-containerize-hono-server.md`.

## Goal

Run Bookkeeping on the owner's phone from a real URL, so the installed PWA,
cross-origin cookies, and capture latency are proven on a mobile network.
The data entered during this trial is disposable.

## Topology

One Railway Hobby project, region Singapore, one environment `production`.

| Service  | Source                     | Public hostname                | Notes                                          |
| -------- | -------------------------- | ------------------------------ | ---------------------------------------------- |
| api      | `apps/server/Dockerfile`   | `api.bookkeeping.boonyarit.me` | Node.js; app sleeping off; health at `/health` |
| web      | `apps/web/Dockerfile`      | `bookkeeping.boonyarit.me`     | Caddy serving the built SPA                    |
| postgres | Railway-managed PostgreSQL | none (private network)         | Major version 18, matching local and tests     |

- DNS for `boonyarit.me` stays at its current host (Hostinger); the personal
  site on the apex is untouched. Both hostnames are CNAMEs to Railway, not
  proxied through a CDN.
- Budget: $10 a month. Expected $6–8; check the real usage after the first
  week.

## Configuration

- api: `DATABASE_URL` references the Postgres service over the private
  network; `BETTER_AUTH_URL=https://api.bookkeeping.boonyarit.me`;
  `CLIENT_ORIGINS=https://bookkeeping.boonyarit.me`; a generated
  `BETTER_AUTH_SECRET`; `AUTH_SIGN_UP` per the switch below.
- web: `VITE_API_ORIGIN=https://api.bookkeeping.boonyarit.me`, a build-time
  value baked into the bundle.
- Caddy: unknown paths fall back to `index.html`; hashed files under
  `/assets/` are `Cache-Control: public, max-age=31536000, immutable`;
  `index.html`, the service worker, and the manifest are `no-cache` so
  installed PWAs pick up new releases.

## Sign-up switch

A server environment flag `AUTH_SIGN_UP` (`on`/`off`, default `on`, same
shape as `AUTH_RATE_LIMIT`) maps to Better Auth's `disableSignUp`. Local
development and tests keep the default. Production sets `off` after the
owner's account exists; changing it takes effect on the redeploy Railway
performs when a variable changes. The web sign-up screen is unchanged and
shows the server's rejection.

## Deploys and schema

- Railway's GitHub integration deploys `main`, waiting for the CI workflow to
  pass. Each service watches only the paths that affect its image.
- Schema changes during the trial: `pnpm db:push` run by hand against the
  database's public TCP proxy, which is enabled only while in use. No
  pre-deploy schema step and no `--force`.

## Out of scope (next scope)

Real data may not be recorded until both of these exist:

- A database migration strategy replacing `db:push` for production. Per
  `CLAUDE.md`, only the owner authorizes that switch.
- Automated backups: direction is a nightly `pg_dump`, encrypted with `age`,
  stored in Cloudflare R2 (off Railway), with retention and a restore drill
  still to be decided.

Also out: staging or preview environments, uptime monitoring, CDN in front of
either service, and a client-visible sign-up state.

## Order of tickets

Agents read `worker-brief.md` before any ticket. 01 and 02 are independent;
03 follows 02; 04 (human) follows all three.
