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

## Comments

### 2026-09-20 — implementation

Scenario table (application file: `packages/application/src/wallets/wallet.integration.test.ts` unless noted):

| #   | web test title                                                                                                            | scenario                                                                                                                                             | covering application test (file :: title) or PORT                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | an opening replacement through the application keeps a recorded movement and its recording time                           | `replaceWalletOpening` to an extreme negative opening succeeds and the balance is `-100000000000000099n`                                             | `wallet.integration.test.ts` :: "replaces amount and date together, records the change, and keeps recording times" (asserts `balance: -100_000_000_000_000_099n`)                                       |
| 2   | (same)                                                                                                                    | the existing movement's `recordedAt` is unchanged after the opening replacement                                                                      | same test (asserts `row.recordedAt` equals the pre-replacement value)                                                                                                                                   |
| 3   | a deleted transfer still guards deletion and opening dates for both wallets                                               | `deleteWallet` → `history-remains` on both sides of a _deleted_ transfer                                                                             | PORT — the existing "rejects wallets with current transactions on either transfer side" uses a live transfer only                                                                                       |
| 4   | (same)                                                                                                                    | `replaceWalletOpening` → `movement-before-opening` on both sides of a deleted transfer                                                               | "a movement before the proposed opening on either transfer side is rejected, even once deleted"                                                                                                         |
| 5   | archive through the application retains current/historical totals, rejects new archived wallets, and restores eligibility | archived wallet still counts in the current total (`19900n`)                                                                                         | PORT — no application test asserts a current listing/total including an archived wallet                                                                                                                 |
| 6   | (same)                                                                                                                    | archived wallet still counts in the `asOf` total (`20000n`)                                                                                          | `transaction-reads.integration.test.ts` :: "corrections, archiving and category fallbacks replace effects across history and reports" (asserts `asOf` balances `[1_040_000n, 0n]` after archiving cash) |
| 7   | (same)                                                                                                                    | `createTransaction` on an archived wallet → `wallet-archived` with `walletId`                                                                        | `transaction-create.integration.test.ts` :: "requires owned active wallets and a category from the matching tree"                                                                                       |
| 8   | (same)                                                                                                                    | after un-archiving, `createTransaction` on the wallet succeeds                                                                                       | PORT — "restores by clearing the archived instant…" asserts `archivedAt: null` but never records a movement afterwards                                                                                  |
| 9   | all operations isolate ownership; unused wallets can delete but snapshot and wallet history cannot                        | `deleteWallet` by a stranger → `wallet-not-found`                                                                                                    | `deleteWallet` :: "does not disclose an unknown or another owner's wallet"                                                                                                                              |
| 10  | (same)                                                                                                                    | `setWalletArchived` by a stranger → `wallet-not-found`                                                                                               | `setWalletArchived` :: "another owner's, an unknown, and a malformed wallet id are not found alike"                                                                                                     |
| 11  | (same)                                                                                                                    | wallet referenced only by a retained transaction snapshot (movement moved elsewhere) → `history-remains`                                             | `deleteWallet` :: "rejects a wallet referenced only by a retained transaction snapshot" (snapshot inserted via fixture rather than `updateTransaction`; same check, same outcome)                       |
| 12  | (same)                                                                                                                    | a wallet with no movements or history deletes (`ok: true`)                                                                                           | `deleteWallet` :: "deletes an eligible wallet and treats a repeat as not found"                                                                                                                         |
| 13  | (same)                                                                                                                    | an archived wallet (wallet change history) → `history-remains`                                                                                       | `deleteWallet` :: "rejects a wallet with retained wallet change history"                                                                                                                                |
| 14  | a create waiting behind archive rechecks eligibility after its lock is released                                           | a create blocked on the wallet's `FOR UPDATE` lock is rejected `wallet-archived` once the archive commits, and exactly one wallet change is recorded | PORT — the only concurrency test in the application suite (`transaction-delete` :: "…serialize on the locked expense") is a different lock                                                              |

Ports: rows 3, 5, 8, 14 → three new tests (one per source web test, titles kept) in a
`describe("wallet lifecycle")` block at the end of `wallet.integration.test.ts`, with a
local `openCashPairWithExpense` fixture built on the suite's own `openCashPair`
(same 10 000-satang openings as the web fixture, so the total assertions copy unchanged)
plus `initializeDefaultCategories`/`listCategories` for the expense category. Bodies copied
verbatim; only imports and the fixture call changed. Row 3's ported test also repeats the
row-4 assertion because it is part of the copied body.

Deleted: `apps/web/src/features/wallets/server/wallet-lifecycle.integration.test.ts` and
`apps/web/src/testing/wallet-fixture.ts` (its only importer was the deleted test).

One thing to flag: after the deletion, `pnpm --filter @bookkeeping/web types:check` failed
in the kept `session.integration.test.ts` (`inject("testDatabaseUrl")` typed as `never`).
The `ProvidedContext` augmentation lives in `packages/database/src/testing/url.ts` and had
only reached the web type program through the deleted test's `@bookkeeping/database/testing`
import. Rather than touch the session test or the database package, I added
`apps/web/src/testing/vitest-context.d.ts` containing a single side-effect import of
`@bookkeeping/database/testing`. It is a four-line type shim, not production code, but it is
a new file the ticket did not name — reviewer to confirm.

Ran (one package at a time):

- `pnpm --filter @bookkeeping/application exec vitest run` — 172 passed (before: 169, after tickets 06/07; +3 ports)
- `pnpm --filter @bookkeeping/web exec vitest run` — 41 passed (before: 46, after tickets 06/07; −5)
- `pnpm --filter @bookkeeping/application types:check`, `pnpm --filter @bookkeeping/web types:check`, `pnpm lint` — clean
