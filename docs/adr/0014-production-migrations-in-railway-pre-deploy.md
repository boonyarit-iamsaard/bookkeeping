# Production applies migrations in Railway's pre-deploy step

Production adopted `0000_baseline` on 2026-10-31 without running it: a
checked `pg_dump --schema-only` diff proved its schema matched, and only then
was the baseline recorded in `drizzle.__drizzle_migrations`. Every later
migration runs in the `api` service's pre-deploy step. The new image runs
`node dist/migrate.js` before it takes traffic, with the migrations folder
shipped inside the image and the service's own `DATABASE_URL`. Drizzle applies
all pending migrations in one transaction, and the migrator gives up on locks
after 5 seconds, so a failure applies nothing, stops the deploy, and leaves the
old version serving. Merging a PR that adds a migration is the owner's
authorization to apply it; before merging, the owner triggers a manual backup.
The design is in `.scratch/production-migrations/spec.md`.

## Considered options

- Running the migrator when the server starts: rejected. A failed migration
  would crash the new version after Railway had started it, and every restart
  would try again. Pre-deploy runs once, before traffic.
- The owner running `db:migrate` through a TCP proxy: rejected. It exposes the
  database for every schema change, and a migration reaches production only
  when someone remembers, out of step with the deploy that needs it.
- A GitHub Actions job holding production credentials: rejected. The database
  would need a public address for every run, and CI would hold a production
  secret, against ADR 0013's choice to keep the database private.
- A separate migration role with DDL rights: rejected. The api's credentials
  already have those rights, so a second role adds a production secret without
  taking any right away from the running app.
- A `pg_dump` inside pre-deploy: rejected. The image would need a PostgreSQL
  client matching the server's major version, and a dump taken there still
  has to be encrypted and uploaded. The `backup` service already does both,
  so the owner triggers it by hand before merging.

## Consequences

- Committed migrations are immutable, because production has applied
  `0000_baseline`. A CI step in `pnpm run ci` fails when a PR changes or
  deletes a migration file that exists on `main`; the journal may only gain
  entries.
- A migration must work with the release it replaces, because the old version
  keeps serving if the new one fails its healthcheck: expand first, and drop
  or rename only in a later release once no deployed code reads the old
  shape. This is a review rule, not a CI check.
- A wrong migration that applied is fixed by a newer one. Lost data comes back
  from the manual backup through
  `.scratch/production-recovery/runbooks/recover-production.md`.
- The backup manifest still covers `public` only; the recovery runbook checks
  the migrations table against the deployed journal instead.
- Agents never merge a PR that adds a migration. The PR template carries the
  backup line.
