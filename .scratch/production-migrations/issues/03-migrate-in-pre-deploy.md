# 03: Run migrations in Railway's pre-deploy step

Read `../spec.md` first (Packaging, Lock timeout, Pre-deploy).

**What to build:** The api image carries the migrations and a migrate
entrypoint, and Railway runs it before each `api` deploy takes traffic. A
failed migration stops the deploy and the old version keeps serving.

**Blocked by:** 02 (done)

**Status:** done

**Notes:** Part of PR 2 with 04 and 05, replayed onto a fresh branch from
`main` after PR 1 merges. Confirm how `railway/iac` declares a pre-deploy
command against its current docs before writing it.

- [x] `apps/server/scripts/build.ts` builds `src/migrate-cli.ts` into `dist/migrate.js`.
- [x] The runtime image copies `packages/database/drizzle/` to `/app/drizzle`.
- [x] The migrate entrypoint sets `lock_timeout = '5s'` before migrating; a test shows a held lock fails the migration within the timeout and applies nothing.
- [x] Image smoke test: `node dist/migrate.js` in the built image migrates a local Postgres, and a test-only fixture folder with a second migration applies.
- [x] `.railway/railway.ts` declares `node dist/migrate.js` as the `api` pre-deploy command; `railway plan` shows only that change.
- [x] Server suite and `pnpm run ci` pass.

## Comments

- The deploy entrypoint is `apps/server/src/migrate-cli.ts`; it calls
  `migrateDatabase` with `lockTimeoutMs: 5000`, sent as the `lock_timeout`
  startup parameter on every connection. The server now declares
  `pg-connection-string`, which the bundled migrator imports.
- The image smoke test is `apps/server/src/migrate-cli.image.test.ts`, run with
  `pnpm --filter @bookkeeping/server test:image`. It builds the api image, so
  it stays out of `pnpm test` and `pnpm run ci`. It also runs the held-lock
  case through the real entrypoint (fails after 5 s, applies nothing); the
  database suite covers the same option on every run.
- `railway config plan` (2026-10-31): `1 to change`, only
  `api deploy.preDeployCommand (null → ["node dist/migrate.js"])`.

2026-10-31: Done in 27edbb4, with review fixes in 7abe7b7 (the 5 s limit now
lives in `apps/server/src/migration-lock.ts` as `LOCK_TIMEOUT_MS`; shared
test helpers in `packages/database/src/testing/`). Database 21/21, server
217/217, `test:image` 3/3, `pnpm run ci` passes. Production's pre-deploy is
confirmed in 06.
