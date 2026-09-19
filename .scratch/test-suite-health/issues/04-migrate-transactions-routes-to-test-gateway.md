# 04: Migrate transactions route suite to the test gateway

**What to build:** `apps/server/src/features/transactions/transaction.routes.integration.test.ts` provisions its
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

- [ ] Suite uses the test gateway; 42 tests pass; no assertion changed
- [ ] Duration before/after recorded in Comments
- [ ] Types and lint clean

## Comments

Agent run, 2026-09-19.

**What was built**

- Same pattern as ticket 01: every app creation passes
  `{ auth: createTestAuthGateway(db) }`.
- The suite's local wrapper `createOwner` now provisions through
  `createOwnerSession(db)` instead of `signUpWithSession(app, label)`, keeping
  the returned `{ cookie, ownerId }` shape its callers destructure. As in
  ticket 01, the wrapper's now-dead `app` and `label` plumbing went away:
  `createOwner({ db })` with `OwnerRequest` reduced to `{ db }`, and all 50
  call sites updated (`createOwner(app, { db, label: "…" })` →
  `createOwner({ db })`). Its own `initializeDefaultCategories` call stays —
  this suite never relied on the sign-up hook.
- No test in this file has the managed auth routes as its subject, so no
  second real-auth app instance was needed.
- No test, assertion, or test order was touched; verified by diffing the
  assertion lists before/after (42 identical full names).

**What I ran**

- This file alone before (change stashed) and after, both with
  `vitest run --reporter=json`: 42/42 pass both ways; sum of test durations
  13.58 s → 5.71 s (323 → 136 ms/test, ≈ 2.4×). facts.md's 16.7 s file time
  used a different measurement, so I re-measured before with the same method.
  In the green full-suite JSON run
  (`--reporter=json --outputFile=/tmp/server.json`), this file's window is
  6.96 s (before per facts.md: 16.7 s).
- Full server suite: 209/209 pass (one earlier run had two 5 s timeouts under
  machine load — the untouched `api-contract` test and one categories
  concurrency test; an immediate re-run was green. Same flake ticket 01
  flagged).
- `pnpm --filter @bookkeeping/server types:check` — clean. `pnpm lint` —
  clean. `biome check --write` on the touched file.

**Unsure about / notes**

- None. No stop-and-ask trigger fired; the diff touches only this test file.
