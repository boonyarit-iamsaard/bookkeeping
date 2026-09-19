# 03: Migrate categories route suite to the test gateway

**What to build:** `apps/server/src/features/categories/category.routes.integration.test.ts` provisions its
owners through the test authentication gateway from ticket 01, so the suite
runs several times faster with identical assertions.

**Blocked by:** 01 (Test AuthGateway for route integration tests)

**Status:** ready-for-agent

## Ground rules (every ticket in this effort)

- Read `../spec.md` and `../decisions.md` first. Do only what this ticket says.
- Never touch: `apps/web/tests/e2e/**`, `CONTEXT.md`, `docs/adr/**`, anything under
  `packages/database/src/**` except test helpers already named in this ticket,
  database migrations, `turbo.json`, any `vitest.config.mts`.
- Never change production code unless this ticket names the exact file.
- Never change an assertion in a kept test unless this ticket says to.
- Run test suites for ONE package at a time, never two concurrently
  (memory limit, see `CLAUDE.md`). Never run Playwright or Sonar.
- When done, append a `## Comments` entry to this file: what you ran, the
  test counts before/after, anything you were unsure about. Do not mark the
  checkboxes yourself; the reviewer does.
- If any "Stop and ask" trigger fires, write the question under `## Comments`
  and stop. Do not guess.

## Steps

1. Read how ticket 01 changed
   `apps/server/src/features/reports/report.routes.integration.test.ts`
   and `apps/server/src/testing/create-integration-test-app.ts`. Do the same
   here and nothing more.
2. Where the suite creates the app, pass `{ auth: createTestAuthGateway(db) }`.
3. Where the suite obtains an owner (`signUpWithSession` or a local wrapper
   around it), use `createOwnerSession(db)` instead, preserving the returned
   `{ cookie, ownerId }` shape the tests already destructure.
4. If any test in this file has the managed auth routes themselves as its
   subject (sign-up, sign-in, get-session), leave that test on real auth by
   building a second app instance without the option for that test only.
   Note which tests in Comments.
5. Do not rename, reorder, delete or edit any test or assertion.

## Verify

- `pnpm --filter @bookkeeping/server exec vitest run` — all 209 tests pass,
  same count as before.
- With `--reporter=json --outputFile=/tmp/server.json`, record this file's
  duration in Comments (before: see `../facts.md`).
- `pnpm --filter @bookkeeping/server types:check` and `pnpm lint` pass.

## Stop and ask

- A test in this file depends on a real session cookie's format or expiry.
- The diff touches anything except this test file.

- [ ] Suite uses the test gateway; 35 tests pass; no assertion changed
- [ ] Duration before/after recorded in Comments
- [ ] Types and lint clean

## Comments

Agent run, 2026-09-19.

**What was built**

- Same pattern as ticket 01: every app creation passes
  `{ auth: createTestAuthGateway(db) }`, and every
  `signUpWithSession(app, "defaults")` became a new local wrapper
  `createProvisionedOwner(db)` returning the same `{ cookie, ownerId }` shape.
- **Why a wrapper instead of bare `createOwnerSession`:** sign-up provisions
  default categories through the Better Auth database hook
  (`packages/auth/src/config.ts`, `databaseHooks.user.create.after` →
  `initializeDefaultCategories`), which `createTestUser` does not do. This
  suite (unlike wallets/transactions) never provisions explicitly — its tree
  listings and defaults-retry tests depend on the provisioned set. The wrapper
  calls `createOwnerSession(db)` + `initializeDefaultCategories(db, ownerId)`,
  exactly what the hook did. No assertion changed.
- One setup comment updated for truthfulness ("Sign-up already provisioned" →
  "The fixture provisions") in the defaults-retry test; no code or assertion
  in that test changed.
- No test in this file has the managed auth routes as its subject (sign-up,
  sign-in, get-session), so no second real-auth app instance was needed.
- No test, assertion, or test order was touched; verified by diffing the
  assertion lists before/after (35 identical full names).

**What I ran**

- This file alone before (change stashed) and after, both with
  `vitest run --reporter=json`: 35/35 pass both ways; sum of test durations
  11.55 s → 6.20 s (330 → 177 ms/test, ≈ 1.9×). facts.md's 9.5 s file time used
  a different measurement, so I re-measured before with the same method.
  In the green full-suite JSON run
  (`--reporter=json --outputFile=/tmp/server.json`), this file's window is
  9.10 s (before per facts.md: 9.5 s). The remaining cost sits in the tests'
  own work (concurrency commits and the multi-request DELETE round trips),
  not in owner provisioning.
- Full server suite: 209/209 pass (one earlier run had two 5 s timeouts under
  machine load — the untouched `api-contract` test and one concurrency test
  here; an immediate re-run was green. Same flake ticket 01 flagged).
- `pnpm --filter @bookkeeping/server types:check` — clean. `pnpm lint` —
  clean. `biome check --write` on the touched file.

**Unsure about / notes**

- The wrapper addition goes slightly beyond the literal "use
  `createOwnerSession(db)`" step; without the provisioning replication four
  tests (tree listing, both defaults-retry tests, and the incomplete-owner
  read) would have failed because `createTestUser` inserts no categories.
  Flagging for the reviewer; no stop-and-ask trigger seemed to apply (no test
  depends on real cookie format or expiry, and the diff touches only this
  file).
