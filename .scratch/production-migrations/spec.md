# Production applies migrations

Status: done

Decided on 2026-10-31 by grilling. Read
`docs/adr/0009-drizzle-migrations-outside-production.md` (with its
2026-10-17 amendment) and
`docs/adr/0013-nightly-encrypted-backups-to-aws-s3.md` first. Both gates this
spec waited on are closed: the first passing restore drill
(`../production-backups/issues/06-restore-drill.md`) and the recovery
rehearsal (`../production-recovery/issues/03-recovery-rehearsal.md`).

## Problem Statement

Production has held the owner's real ledger since 2026-09-27, and its schema
came from one `pnpm db:push` through a temporary TCP proxy on that day. It
has no `drizzle.__drizzle_migrations` table. Every other database is built
from the committed migrations, so the first schema change the app needs has
no path to production except another hand-run push, which records nothing
and can drop data without asking. The database cannot be wiped and rebuilt
from the baseline, because it holds real money. The api image cannot run the
migrator either: `apps/server` is an esbuild bundle, and the runtime image
ships neither the migrations folder nor a migrate entrypoint.

## Solution

Two steps, in order. First, production adopts `0000_baseline` without running
it. A tested command proves production's schema matches the baseline exactly
and only then records the baseline as applied. The owner runs it once, after a
manual backup, through the TCP proxy. Second, every later migration reaches
production in Railway's pre-deploy step on the `api` service: the new image
runs the migrator before it takes traffic, and a failure stops the deploy while
the old version keeps serving. From adoption on, committed migrations are
immutable and CI enforces it. Merging a PR that adds a migration is the
owner's authorization to apply it, and a manual backup comes first.

## User Stories

1. As the owner, I want production's existing schema adopted as `0000_baseline` without rerunning it, so that the real ledger joins the migration history in place.
2. As the owner, I want adoption to refuse unless production's schema matches the baseline exactly, so that later migrations never start from a wrong assumption.
3. As the owner, I want the match judged on `pg_dump --schema-only` output, so that indexes, constraints and defaults Drizzle does not model are compared too.
4. As the owner, I want a `--check` mode that diffs and writes nothing, so that I can read the result before anything changes.
5. As the owner, I want a refused adoption to print the diff, so that I can see what drifted.
6. As the owner, I want adoption to refuse when the migrations table already exists, so that running it twice is harmless.
7. As the owner, I want adoption to refuse when the journal holds anything other than the baseline, so that a later migration is never recorded as applied without running.
8. As the owner, I want the baseline row written in one transaction, so that a failure leaves production as it was.
9. As the owner, I want the row's format pinned by a test against Drizzle's own migrator, so that the next `migrate` sees the baseline as applied.
10. As the owner, I want a runbook for the one adoption run, so that I follow written steps against the real ledger.
11. As the owner, I want a manual backup taken before adoption, so that the run has a restore point from minutes earlier.
12. As the owner, I want every later migration applied in Railway's pre-deploy step, so that a migration reaches production with the deploy that needs it and nobody has to remember it.
13. As the owner, I want a failed migration to stop the deploy while the old version keeps serving, so that a bad migration never takes the app down.
14. As the owner, I want the migrator to give up on locks after 5 seconds, so that a blocked migration fails the deploy instead of stalling the app's queries.
15. As the owner, I want the migrator to use the api's own `DATABASE_URL`, so that no second production secret exists.
16. As the owner, I want the migrations shipped inside the api image, so that the image that runs is the image that migrates.
17. As the owner, I want CI to reject any change to a committed migration, so that the history production applied can never be rewritten.
18. As the owner, I want a PR template line reminding me to take a manual backup before merging a migration, so that the reminder appears at merge time.
19. As the owner, I want every migration to work with the release it replaces, so that the old version keeps working if the new deploy fails its healthcheck.
20. As the owner, I want my merge to be the authorization to apply a migration, so that agents never apply one on their own.
21. As the owner, I want the recovery runbook to fix bad migrations forward, so that it stops advising a revert that leaves the schema changed.
22. As the owner, I want a restored database's migrations table checked against the deployed journal before redeploying, so that I know whether the next deploy will reapply a migration.
23. As the owner, I want the decision recorded in an ADR, so that the reasons outlive this spec.
24. As the owner, I want the first production deploy after the change to show the migrator ran with nothing pending, so that the whole path is proven without a dummy migration.

## Implementation Decisions

- **Adoption command.** `@bookkeeping/database` gains `db:adopt-baseline`,
  reading production's URL the same way the other `db:*` scripts read
  `DATABASE_URL`. It:
  1. refuses unless the journal holds exactly `0000_baseline`;
  2. refuses if the `drizzle.__drizzle_migrations` table exists;
  3. starts a throwaway Postgres from the image pinned in
     `apps/backup/Dockerfile` (`postgres:18-alpine` by digest) and applies
     the baseline with `migrateDatabase`;
  4. runs `pg_dump --schema-only --no-owner --no-privileges` from that same
     image against both databases, strips comments, `SET` lines and the
     `drizzle` schema, and diffs the results; any difference prints the diff
     and exits 1;
  5. without `--check`, creates the `drizzle` schema and migrations table and
     inserts the baseline's row (its hash and the journal's `when` as
     `created_at`) in one transaction.

  `--check` stops after step 4. The throwaway container is always removed.

- **Packaging.** `apps/server/scripts/build.ts` adds `src/migrate-cli.ts` as a
  third entry, producing `dist/migrate.js`. The runtime image copies
  `packages/database/drizzle/` to `/app/drizzle`; `migrate.ts` resolves
  `../drizzle` from `import.meta.url`, which is `/app/drizzle` from
  `/app/dist/migrate.js`, so the path needs no change.
- **Lock timeout.** The migrate entrypoint sets `lock_timeout = '5s'` on its
  connection before migrating. Drizzle runs all pending migrations in one
  transaction, so a timeout applies nothing.
- **Pre-deploy.** `.railway/railway.ts` declares `node dist/migrate.js` as the
  `api` service's pre-deploy command. It runs with the service's
  `DATABASE_URL`. No separate migration role.
- **Freeze.** A database-free CI step in `pnpm run ci` fails when a PR
  modifies or deletes any file under `packages/database/drizzle/` that exists
  on `main`, except `meta/_journal.json`, which may only gain entries.
  New migration files and snapshots pass.
- **Backup before merge.** Before merging a PR that adds a migration, the
  owner triggers the `backup` service by hand outside 20:00–20:59 UTC and
  confirms `uploaded to manual/…`. A new `.github/pull_request_template.md`
  carries this as its one line.
- **Compatibility rule.** A migration must work with the code it replaces:
  expand first; drop or rename only in a later release once no deployed code
  reads the old shape. A review rule, not a CI check.
- **Failure handling.** A pre-deploy failure applies nothing; fix forward in a
  new PR. A migration that applied but was wrong is fixed by a newer
  migration; lost data comes back through the recovery runbook from the
  manual backup.
- **Authorization.** `CLAUDE.md` changes from "applying migrations to
  production waits for the owner's explicit authorization" to: agents never
  merge a PR that adds a migration; the owner's merge authorizes it. The
  one-time adoption still needs the owner's explicit go-ahead.
- **Documentation.**
  - New `docs/adr/0014-production-migrations-in-railway-pre-deploy.md`
    records where migrations run, the shared credentials, the backup rule,
    and the rejected options: running on server start, the owner running
    `db:migrate` through the proxy, a GitHub Actions job holding production
    credentials, a separate migration role, and a `pg_dump` inside pre-deploy.
  - ADR 0009 gains an amendment pointing to 0014.
  - `docs/code-conventions.md#database-migrations` drops "may be squashed",
    adds immutability, the compatibility rule and the backup-before-merge
    rule.
  - `../production-recovery/runbooks/recover-production.md` rewrites step 8a
    as fix forward, and adds a check after restore comparing
    `drizzle.__drizzle_migrations` with the deployed journal before
    redeploying.
- **Backup manifest unchanged.** `apps/backup/manifest.sql` keeps covering
  `public` only. Adding the migrations table would fail the drill on every
  older backup; the runbook check above covers it. `backup.sh` already dumps
  the whole database, so the `drizzle` schema is in every backup.
- **Branches.** One branch, `feat/production-migrations`. Ticket 01 ships
  alone as PR 1. After it merges and the owner completes 02, the post-merge
  commits replay onto a fresh branch from `main` for PR 2 (tickets 03–05).

## Testing Decisions

- Good tests assert what the owner observes: adoption refuses or succeeds, a
  migrated database works, a changed migration fails CI. They do not assert
  SQL text or which Drizzle function ran.
- **Adoption** gets integration tests in the database package against
  Testcontainers databases, following the existing migrate and fresh tests:
  - a database built by `drizzle-kit push` from the current tables adopts
    cleanly, after which `migrateDatabase` succeeds and applies nothing;
  - a database with one extra index, or one missing constraint, is refused
    with that object in the printed diff, and nothing is written;
  - an existing migrations table is refused;
  - a journal with a second entry is refused (fixture folder);
  - `--check` on a matching database writes nothing.
- **Packaging** gets an image smoke test: build the api image, run
  `node dist/migrate.js` against a local Postgres, then again against a
  test-only fixture folder holding a second migration, which applies.
- **Lock timeout**: a test holds a lock on a table and shows a migration
  touching it fails within the timeout and applies nothing.
- **Freeze** has no automated test. The implementer demonstrates it once
  against an edited baseline, a deleted snapshot, and an added migration,
  records the outputs under Comments, and reverts.
- Run the database and server suites and `pnpm run ci`. No browser specs: the
  browser boundary is untouched.

## Out of Scope

- Drizzle v1 and its folder format.
- A separate migration role with DDL rights.
- Adding the migrations table to the backup manifest.
- A dummy migration to prove delivery.
- Any schema change beyond adopting the baseline.
- Backlog ticket 05 (porting the restore scripts to TypeScript).

## Further Notes

- The schema files last changed on 2026-09-19 and `0000_baseline` was
  generated on 2026-09-27, the day production was pushed, so a clean diff is
  expected. Ticket 02 still proves it.
- Merging PR 2 before adoption fails safely: the pre-deploy tries to create
  tables that exist, the deploy stops, and the old version keeps serving. It
  still blocks every deploy, hence the order.
- `pg_dump` refuses a server newer than itself, so the pinned image's major
  version must stay at or above production's.
- The Drizzle 0.x migrator skips a migration older than the last one applied
  (ADR 0009). One developer keeps this theoretical.
