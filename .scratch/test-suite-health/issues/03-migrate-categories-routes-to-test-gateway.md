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
