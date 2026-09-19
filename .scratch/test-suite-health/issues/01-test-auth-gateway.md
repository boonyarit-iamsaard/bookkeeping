# 01: Test AuthGateway for route integration tests, proven on report routes

**What to build:** Route integration tests get their owner from a test
authentication gateway instead of a real Better Auth sign-up, so each route
test costs roughly what an application test costs. This ticket adds the
gateway and migrates the smallest route suite (reports) to prove it.

**Blocked by:** None (can start immediately)

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

## Context

- `apps/server/src/core/auth/gateway.ts` defines `AuthGateway`
  (`handleRequest(request)`, `resolveSession(headers)`). Its doc comment
  says tests substitute this contract; `apps/server/src/testing/create-unit-test-app.ts`
  already does (`anonymousAuthGateway`).
- `Session` (from `@bookkeeping/auth/session`) is
  `{ id: string; expiresAt: Date; user: { id: string; email: string; name: string } }`.
- `createTestUser(db)` in `@bookkeeping/database/testing` inserts a user row and
  returns `{ id }`.
- Today every route test calls `signUpWithSession(app, label)` in
  `apps/server/src/testing/create-integration-test-app.ts`, which does a real
  sign-up + get-session (≈300 ms).

## Steps

1. In `apps/server/src/testing/`, add a module exporting
   `createTestAuthGateway(db: Database): AuthGateway`:
   - `resolveSession(headers)`: read a test credential from the `cookie`
     header — a cookie named `bookkeeping-test.user` whose value is a user id.
     If absent → `null`. If present → load the user row by id from the
     database (`users` table via `@bookkeeping/database/auth` or wherever
     `createTestUser` imports it from) and return a `Session` with a fresh
     `id`, `expiresAt` one hour ahead, and the user's id/email/name. Unknown
     id → `null`.
   - `handleRequest()`: return `new Response(null, { status: 404 })`.
     Also export a helper `createOwnerSession(db)` that calls `createTestUser`
     and returns `{ ownerId, cookie }` where `cookie` is
     `bookkeeping-test.user=<id>`.
2. In `create-integration-test-app.ts`, give `createIntegrationTestApp` a
   second optional parameter `options?: { auth?: AuthGateway }`. When
   `options.auth` is provided use it; otherwise build the real Better Auth
   gateway exactly as today. Do not change any other behaviour of this file;
   keep `signUpThroughAuthRoutes` and `signUpWithSession` exported.
3. In `apps/server/src/features/reports/report.routes.integration.test.ts`:
   pass `{ auth: createTestAuthGateway(db) }` where the app is created, and
   replace the local `createOwner` implementation's call to
   `signUpWithSession` with `createOwnerSession(db)`. Keep every assertion
   as-is.
4. Check the unit-test app factory still compiles and that
   `gateway.integration.test.ts` and `api-contract.integration.test.ts` are
   untouched and still use real auth (they must not receive the test gateway).

## Verify

- `pnpm --filter @bookkeeping/server exec vitest run` — all 209 tests pass.
- `pnpm --filter @bookkeeping/server exec vitest run --reporter=json --outputFile=/tmp/server.json`
  then read the report file's duration: previously 2036 ms for 5 tests
  (≈400 ms/test). Record the new number in Comments; expect well under
  1000 ms.
- `pnpm --filter @bookkeeping/server types:check` passes.
- `pnpm lint` passes.

## Stop and ask

- The route handlers derive the owner id from something other than
  `resolveSession` (e.g. they call Better Auth directly).
- Any test outside the reports suite breaks.

- [ ] `createTestAuthGateway` and `createOwnerSession` exist in the server testing directory
- [ ] `createIntegrationTestApp` accepts an optional gateway; default behaviour unchanged
- [ ] Report route suite uses the test gateway; assertions unchanged; per-test time recorded
- [ ] Server suite: 209 tests pass; types and lint clean
- [ ] `gateway.integration.test.ts` and the contract test still use real auth
