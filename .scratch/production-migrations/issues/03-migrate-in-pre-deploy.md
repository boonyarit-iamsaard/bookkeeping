# 03: Run migrations in Railway's pre-deploy step

Read `../spec.md` first (Packaging, Lock timeout, Pre-deploy).

**What to build:** The api image carries the migrations and a migrate
entrypoint, and Railway runs it before each `api` deploy takes traffic. A
failed migration stops the deploy and the old version keeps serving.

**Blocked by:** 02

**Status:** ready-for-agent

**Notes:** Part of PR 2 with 04 and 05, replayed onto a fresh branch from
`main` after PR 1 merges. Confirm how `railway/iac` declares a pre-deploy
command against its current docs before writing it.

- [ ] `apps/server/scripts/build.ts` builds `src/migrate-cli.ts` into `dist/migrate.js`.
- [ ] The runtime image copies `packages/database/drizzle/` to `/app/drizzle`.
- [ ] The migrate entrypoint sets `lock_timeout = '5s'` before migrating; a test shows a held lock fails the migration within the timeout and applies nothing.
- [ ] Image smoke test: `node dist/migrate.js` in the built image migrates a local Postgres, and a test-only fixture folder with a second migration applies.
- [ ] `.railway/railway.ts` declares `node dist/migrate.js` as the `api` pre-deploy command; `railway plan` shows only that change.
- [ ] Server suite and `pnpm run ci` pass.
