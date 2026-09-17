# 16: Replace a wallet opening balance

**What to build:** Let an authenticated client replace a wallet's complete
opening balance resource while preserving financial-date and history rules.

**Blocked by:** 14: Expose wallet list and detail reads

**Status:** done

- [x] Opening correction moves to the application package with its existing transaction and change-history guarantees.
- [x] The API replaces amount and opening date together as one subordinate resource.
- [x] Exact money, future dates, movements before the proposed opening, ownership, and missing wallets map to documented outcomes.
- [x] Success returns the updated wallet representation and repeat replacement has no additional effect.
- [x] Existing PostgreSQL tests and new authenticated HTTP contract tests remain green.

## Comments

- `@bookkeeping/application/wallets` now owns `replaceWalletOpening`: the
  opening is validated first (`validateWalletOpening`, extracted from
  creation and reused by it, so both keep the fifteen-whole-digit range and
  the Bangkok "no later than today" rule), then under an exclusive wallet
  lock the movement guard runs across both transfer sides including
  soft-deleted rows, the row is updated, and the `opening` change-history
  row is written in the same transaction. Replacing an opening with itself
  updates nothing and records nothing. The operation returns the updated
  `WalletSummary` read through the shared balance query. Errors are
  `invalid-opening` (with field issues), `movement-before-opening`, and
  `wallet-not-found` (unowned, unknown, and malformed ids alike).
- `PUT /v1/wallets/{walletId}/opening` takes `WalletOpeningRequest`
  `{ amount: MoneyInput, date }` and answers 200 with the `Wallet`. Schema
  rejections and application rejections are both 422 `invalid-command`
  addressed by `#/amount/value` and `#/date`; a movement before the
  proposed opening is a 422 at `#/date` with code `movement-before-opening`,
  since choosing an earlier date is the correction. Not found is the
  standard 404; no `Idempotency-Key` is required because PUT is idempotent
  by construction. The money grammar already caps whole digits, so the
  application's `out-of-range` issue is unreachable over HTTP and is
  covered by unit and application tests only.
- The web `manageWalletAction` calls the application operation for the
  `opening` operation and forwards the error code; `wallet-lifecycle.ts`
  keeps only `setWalletArchived` and `deleteWallet` (tickets 17 and 18) and
  its error union shrank to what those produce. The web lifecycle tests that
  covered opening moved to the application package with directly inserted
  transfer rows as movements; the web file keeps a narrower check that the
  application operation preserves a real transaction's recording time.
- Tests: application unit (opening validation), application PostgreSQL
  (replace with history and recording time, no-op repeat, movement guard on
  either transfer side including deleted, invalid opening untouched,
  not-found trio), server unit (OpenAPI operation, path parameter, request
  body, 200/404/422 responses), and in-process HTTP (200 round trip with
  one change row, idempotent repeat, schema 422, application 422, movement
  422 on both wallets, non-disclosing 404 trio, malformed JSON 400, 401).
  The routine gate passed with Biome scoped to `apps packages` because the
  stray `.kilo/worktrees/` checkout still rejects root `biome ci .`; the
  focused `wallet-lifecycle.spec.ts` E2E passed on the desktop project.
