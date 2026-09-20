# 07: Retire the web `history` integration test

**What to build:** `apps/web/src/features/transactions/server/history.integration.test.ts` (4 tests) calls only
`@bookkeeping/application` functions and tests no web code. Every scenario it
asserts must be shown to exist in the application suite — ported if missing —
and then the file is deleted. No behaviour loses coverage.

**Blocked by:** 05 (Split the application transaction suite)

**Status:** resolved

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
   Application files to search: `packages/application/src/transactions/transaction-reads.integration.test.ts` and `packages/application/src/wallets/wallet.integration.test.ts`.
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

## Comments

2026-09-19 (agent):

Scenario table for
`apps/web/src/features/transactions/server/history.integration.test.ts`
(4 tests). Application files searched:
`transaction-reads.integration.test.ts` and `wallet.integration.test.ts`.

| #   | web test title                                                                                    | scenario                                                                                         | covering application test (file :: title) or PORT                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | combines dates, wallet, type and category descendants; transfers match both wallets               | date range, wallet, type, and category-descendant filters combine to select the matching expense | PORT                                                                                                                                                                                                                                                            |
| 2   | combines dates, wallet, type and category descendants; transfers match both wallets               | a refund inherits its expense's category so a parent-category filter matches it                  | PORT (same ported test)                                                                                                                                                                                                                                         |
| 3   | combines dates, wallet, type and category descendants; transfers match both wallets               | a refund matches a type+category filter and exposes `refundOf`                                   | PORT (same ported test)                                                                                                                                                                                                                                         |
| 4   | combines dates, wallet, type and category descendants; transfers match both wallets               | a transfer matches a wallet filter through both its source and its destination                   | PORT (same ported test)                                                                                                                                                                                                                                         |
| 5   | combines dates, wallet, type and category descendants; transfers match both wallets               | another owner's owner-scoped filtered listings are empty                                         | PORT (same ported test)                                                                                                                                                                                                                                         |
| 6   | combines dates, wallet, type and category descendants; transfers match both wallets               | an `asOf` listing before any opening shows zero balances                                         | PORT (same ported test)                                                                                                                                                                                                                                         |
| 7a  | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | monthly totals use financial dates and exclude transfers                                         | transaction-reads.integration.test.ts :: totals use financial dates, own-month refunds, and exact satang independently of transfers                                                                                                                             |
| 7b  | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | own-month refunds count in the monthly totals                                                    | transaction-reads.integration.test.ts :: totals use financial dates, own-month refunds, and exact satang independently of transfers                                                                                                                             |
| 7c  | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | exact satang totals remain exact beyond JavaScript integer precision                             | transaction-reads.integration.test.ts :: totals use financial dates, own-month refunds, and exact satang independently of transfers                                                                                                                             |
| 7d  | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | a refund in the next month lands in that month's totals                                          | transaction-reads.integration.test.ts :: totals use financial dates, own-month refunds, and exact satang independently of transfers                                                                                                                             |
| 7e  | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | a foreign owner's monthly totals are zero                                                        | transaction-reads.integration.test.ts :: totals use financial dates, own-month refunds, and exact satang independently of transfers                                                                                                                             |
| 8   | monthly totals use financial dates, own-month refunds and exact satang independently of transfers | wallet balances aggregate the month's records exactly                                            | transaction-reads.integration.test.ts :: monthly totals use financial dates, own-month refunds and exact satang independently of transfers (wallet-balance port)                                                                                                |
| 9   | corrections, archiving and category fallbacks replace effects across history and reports          | an expense correction moves its financial effect to the corrected date in the monthly summary    | transaction-reads.integration.test.ts :: follows corrections and deletions in the month they apply to                                                                                                                                                           |
| 10  | corrections, archiving and category fallbacks replace effects across history and reports          | `replaceWalletOpening` plus archiving restate the dated wallet balances                          | PORT                                                                                                                                                                                                                                                            |
| 11  | corrections, archiving and category fallbacks replace effects across history and reports          | a renamed category reads through refund rows in listings                                         | PORT                                                                                                                                                                                                                                                            |
| 12  | corrections, archiving and category fallbacks replace effects across history and reports          | after category removals the listings and the monthly summary follow the fallback chain           | PORT                                                                                                                                                                                                                                                            |
| 13a | corrections, archiving and category fallbacks replace effects across history and reports          | deleting a transaction clears it from listings and detail                                        | transaction-reads.integration.test.ts :: follows corrections and deletions in the month they apply to + transaction-delete.integration.test.ts :: removing an income or expense clears its effects from lists, detail, and balances, and keeps one delete entry |
| 13b | corrections, archiving and category fallbacks replace effects across history and reports          | deleting a transaction clears its monthly summary effect                                         | transaction-reads.integration.test.ts :: follows corrections and deletions in the month they apply to                                                                                                                                                           |
| 13c | corrections, archiving and category fallbacks replace effects across history and reports          | deleting a transaction restores its wallet balance                                               | transaction-delete.integration.test.ts :: removing an income or expense clears its effects from lists, detail, and balances, and keeps one delete entry                                                                                                         |
| 14  | corrections, archiving and category fallbacks replace effects across history and reports          | another owner's transaction detail is not found                                                  | transaction-reads.integration.test.ts :: another user's, deleted, and malformed identifiers are not found                                                                                                                                                       |
| 15  | overall balances retain satang beyond JavaScript integer precision and allow negative holdings    | balances retain exact satang beyond JavaScript integer precision (≈9×10¹⁶)                       | PORT (wallet.integration.test.ts)                                                                                                                                                                                                                               |
| 16  | overall balances retain satang beyond JavaScript integer precision and allow negative holdings    | negative holdings are exact                                                                      | wallet.integration.test.ts :: openings beyond signed 32-bit satang and negative openings are exact                                                                                                                                                              |
| 17  | overall balances retain satang beyond JavaScript integer precision and allow negative holdings    | an `asOf` listing shows zero for a wallet opened later                                           | PORT (wallet.integration.test.ts)                                                                                                                                                                                                                               |
| 18  | overall balances retain satang beyond JavaScript integer precision and allow negative holdings    | the exact total across wallets sums beyond 32-bit satang                                         | PORT (wallet.integration.test.ts)                                                                                                                                                                                                                               |

Ported tests (web titles kept; bodies adapted only for imports and the
application suite's fixture helpers):

- `transaction-reads.integration.test.ts`:
  1. combines dates, wallet, type and category descendants; transfers match both wallets
  2. corrections, archiving and category fallbacks replace effects across history and reports
  3. monthly totals use financial dates, own-month refunds and exact satang independently of transfers (wallet-balance port)
- `wallet.integration.test.ts` (inside `listWallets`): 4. overall balances retain satang beyond JavaScript integer precision and allow negative holdings

The web history fixture's custom "History child" category maps to the
application fixture's default `Groceries` child of `Food & Drink`; no new
fixture was needed.

Ran: `pnpm --filter @bookkeeping/application exec vitest run`,
`pnpm --filter @bookkeeping/web exec vitest run`, both packages'
`types:check`, and `pnpm lint` (one package at a time). Test counts recorded
below after each step. `apps/web/src/testing/wallet-fixture.ts` stays (still
imported by `wallet-lifecycle.integration.test.ts`, ticket 08). No "Stop and
ask" trigger fired.

2026-09-19 (agent, final verification):

The history retirement changes this ticket from 165 to 169 application tests
(+4) and from 50 to 46 web tests (-4). The final serial repository run
(`pnpm exec turbo run test --concurrency=1`) was performed before the final
refund-deletion split and passed; the final application package rerun passed
169 tests and the web package passed 46 tests. The application reads and
wallet focused runs passed before the full run.
`pnpm --filter @bookkeeping/application types:check`,
`pnpm --filter @bookkeeping/web types:check`, `pnpm lint`,
`pnpm format:check`, and `pnpm lint:md` passed. No Playwright or Sonar run.

**2026-09-20 — closed.** Resolved in `b4929c3` (test: retire the web transaction and history integration tests). Status line was stale after the commit landed.
