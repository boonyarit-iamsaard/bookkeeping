# 05: Split the application transaction suite by top-level describe

**What to build:** The 3173-line
`packages/application/src/transactions/transaction.integration.test.ts`
becomes four files, one per top-level `describe` group, with shared helpers
moved to the application testing directory. Nothing is added, removed or
reworded; every test body moves verbatim.

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

## Target layout

| New file (same directory)                | Top-level describes it receives                                                                                                     |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `transaction-create.integration.test.ts` | `createTransaction` (includes its nested transfer/refund tests)                                                                     |
| `transaction-update.integration.test.ts` | `updateTransaction` (includes nested `linked refunds`)                                                                              |
| `transaction-delete.integration.test.ts` | `deleteTransaction`                                                                                                                 |
| `transaction-reads.integration.test.ts`  | `findTransaction`, `findReplayedTransaction`, `findExpenseRefunds`, `findLastUsedWalletId`, `listTransactions`, `getMonthlySummary` |

Shared helpers currently at the top of the file (`WalletFixture`,
`insertWallet`, `OwnerFixture`, `setupOwner`, `softDelete`, `withClock`,
`recordExpense`, `expenseUpdateInput`, `balanceOf`, and any others defined
before the first `describe`) move to
`packages/application/src/testing/transaction-suite-fixture.ts` as named
exports. `packages/application/src/testing/transaction-fixture.ts` already
exists; do not merge into it or change it.

## Steps

1. Create the fixture module; move helpers verbatim, add `export`. Helpers
   that call `vi` (e.g. `withClock`) import `vi` from vitest there.
2. Create the four test files. Each starts with
   `const { withRollback, committed } = setupTestDatabase();` (as the original
   does) and imports what it uses from the fixture module and from
   `./transaction`. Copy each top-level describe block byte-for-byte.
3. Delete the original file.
4. Remove unused imports in each new file so lint passes. Do not otherwise
   edit test bodies.

## Verify

- `pnpm --filter @bookkeeping/application exec vitest run` — 137 tests pass
  (51 of them across the four new files; confirm the sum is 51).
- `grep -c "test("` over the four new files sums to the count in the
  original (record both numbers in Comments).
- `pnpm --filter @bookkeeping/application types:check` and `pnpm lint` pass.

## Stop and ask

- A helper is used by only one describe but also mutates module-level state
  that another describe reads.
- A test relies on ordering relative to a test in a different describe.

- [ ] Four files exist; original deleted; fixture module holds the shared helpers
- [ ] Test count unchanged (51 across the four files); 137 in the package
- [ ] No test body edited (reviewer spot-checks by diff of moved blocks)
- [ ] Types and lint clean
