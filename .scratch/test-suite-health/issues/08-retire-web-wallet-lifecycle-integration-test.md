# 08: Retire the web `wallet-lifecycle` integration test

**What to build:** `apps/web/src/features/wallets/server/wallet-lifecycle.integration.test.ts` (5 tests) calls only
`@bookkeeping/application` functions and tests no web code. Every scenario it
asserts must be shown to exist in the application suite — ported if missing —
and then the file is deleted. No behaviour loses coverage.

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

## Definitions

- A **scenario** is one distinct behaviour asserted, not one `test()`. A
  test titled "rejects same wallets, foreign wallets, missing currency" has
  three scenarios.
- A scenario is **covered** only if an application test contains an
  assertion of the same behaviour with the same outcome. Similar titles are
  not evidence; read the assertions.

## Steps

1. **Scenario table first.** Before editing anything, append to this file
   under `## Comments` a table with one row per scenario:
   `| # | web test title | scenario | covering application test (file :: title) or PORT |`.
   Application files to search: `packages/application/src/wallets/wallet.integration.test.ts`.
2. **Port.** For every `PORT` row, add a test to the matching application
   file by copying the web test body and adapting only imports and fixtures
   (use the application suite's own `setupOwner`/fixture helpers). Keep the
   web test's title. One new `test()` per PORT row, or one per web test if
   several PORT scenarios come from one test.
3. **Delete** the web file.
4. If `apps/web/src/testing/wallet-fixture.ts` is now unused by any test,
   delete it too; if other tests still import it, leave it.

## Verify

- `pnpm --filter @bookkeeping/application exec vitest run` passes; record the
  new test count (before: 137, or the count after preceding tickets).
- `pnpm --filter @bookkeeping/web exec vitest run` passes; record the new
  count (before: 90, or the count after preceding tickets).
- `pnpm --filter @bookkeeping/web types:check`,
  `pnpm --filter @bookkeeping/application types:check`, `pnpm lint` pass.

## Stop and ask

- A PORT scenario cannot be expressed against application functions without
  new production code or a new fixture beyond copying.
- A scenario's expected outcome contradicts what the application suite
  asserts for the same input.

- [ ] Scenario table in Comments, every row resolved to a covering test or a port
- [ ] Ported tests added; application suite passes
- [ ] Web file deleted; web suite passes
- [ ] Types and lint clean
